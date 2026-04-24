module "network" {
  source = "./modules/network"

  name_prefix              = local.name_prefix
  vpc_cidr                 = var.vpc_cidr
  availability_zones       = var.availability_zones
  public_subnet_cidrs      = var.public_subnet_cidrs
  private_app_subnet_cidrs = var.private_app_subnet_cidrs
  private_db_subnet_cidrs  = var.private_db_subnet_cidrs
  tags                     = local.common_tags
}

module "ecr" {
  source = "./modules/ecr"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

module "security" {
  source = "./modules/security"

  name_prefix        = local.name_prefix
  vpc_id             = module.network.vpc_id
  web_container_port = var.web_container_port
  api_container_port = var.api_container_port
  db_port            = 5432
  tags               = local.common_tags
}

module "ecs_cluster" {
  source = "./modules/ecs-cluster"

  cluster_name = local.name_prefix
  tags         = local.common_tags
}

module "database" {
  source = "./modules/rds"

  name_prefix             = local.name_prefix
  db_name                 = var.db_name
  master_username         = var.db_master_username
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  max_allocated_storage   = var.db_max_allocated_storage
  subnet_ids              = module.network.private_db_subnet_ids
  security_group_ids      = [module.security.rds_security_group_id]
  multi_az                = var.db_multi_az
  backup_retention_period = var.db_backup_retention_period
  deletion_protection     = var.db_deletion_protection
  skip_final_snapshot     = var.db_skip_final_snapshot
  tags                    = local.common_tags
}

module "api_runtime_secret" {
  source = "./modules/secrets"

  name        = "${local.name_prefix}-api-runtime"
  description = "Runtime secrets for ${local.name_prefix} api"
  secret_values = {
    DATABASE_URL             = local.database_url
    JWT_SECRET               = var.jwt_secret
    CLOUDINARY_UPLOAD_URL    = var.cloudinary_upload_url
    CLOUDINARY_UPLOAD_PRESET = var.cloudinary_upload_preset
    YOUTUBE_API_KEY          = var.youtube_api_key
  }
  tags = local.common_tags
}

module "api_certificate" {
  source = "./modules/acm-certificate"

  domain_name = local.api_domain_name
  zone_name   = local.hosted_zone_name
  tags        = local.common_tags
}

module "web_certificate" {
  source = "./modules/acm-certificate"

  providers = {
    aws = aws.us_east_1
  }

  domain_name = local.app_domain_name
  zone_name   = local.hosted_zone_name
  tags        = local.common_tags
}

module "api_alb" {
  source = "./modules/alb"

  name_prefix         = "${local.name_prefix}-api"
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.public_subnet_ids
  security_group_id   = module.security.api_alb_security_group_id
  target_port         = var.api_container_port
  health_check_path   = var.api_health_check_path
  enable_https        = true
  certificate_arn     = module.api_certificate.certificate_arn
  deletion_protection = var.environment == "production"
  tags                = local.common_tags
}

module "web_alb" {
  source = "./modules/alb"

  name_prefix         = "${local.name_prefix}-web"
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.public_subnet_ids
  security_group_id   = module.security.web_alb_security_group_id
  target_port         = var.web_container_port
  health_check_path   = var.web_health_check_path
  enable_https        = false
  certificate_arn     = null
  deletion_protection = var.environment == "production"
  tags                = local.common_tags
}

module "api_service" {
  source = "./modules/ecs-service"

  cluster_arn         = module.ecs_cluster.cluster_arn
  cluster_name        = module.ecs_cluster.cluster_name
  service_name        = "${local.name_prefix}-api"
  container_name      = "api"
  container_image     = "${module.ecr.api_repository_url}:${var.api_image_tag}"
  container_port      = var.api_container_port
  cpu                 = var.api_cpu
  memory              = var.api_memory
  desired_count       = var.api_desired_count
  min_capacity        = var.api_min_capacity
  max_capacity        = var.api_max_capacity
  subnet_ids          = module.network.private_app_subnet_ids
  security_group_ids  = [module.security.api_ecs_security_group_id]
  target_group_arn    = module.api_alb.target_group_arn
  log_retention_days  = var.log_retention_in_days
  secret_arns         = [module.api_runtime_secret.secret_arn]
  environment_variables = {
    PORT        = tostring(var.api_container_port)
    NODE_ENV    = "production"
    CORS_ORIGIN = "https://${local.app_domain_name}"
  }
  secrets = {
    DATABASE_URL             = "${module.api_runtime_secret.secret_arn}:DATABASE_URL::"
    JWT_SECRET               = "${module.api_runtime_secret.secret_arn}:JWT_SECRET::"
    CLOUDINARY_UPLOAD_URL    = "${module.api_runtime_secret.secret_arn}:CLOUDINARY_UPLOAD_URL::"
    CLOUDINARY_UPLOAD_PRESET = "${module.api_runtime_secret.secret_arn}:CLOUDINARY_UPLOAD_PRESET::"
    YOUTUBE_API_KEY          = "${module.api_runtime_secret.secret_arn}:YOUTUBE_API_KEY::"
  }
  health_check_grace_period_seconds = 90
  tags                              = local.common_tags
}

module "web_service" {
  source = "./modules/ecs-service"

  cluster_arn         = module.ecs_cluster.cluster_arn
  cluster_name        = module.ecs_cluster.cluster_name
  service_name        = "${local.name_prefix}-web"
  container_name      = "web"
  container_image     = "${module.ecr.web_repository_url}:${var.web_image_tag}"
  container_port      = var.web_container_port
  cpu                 = var.web_cpu
  memory              = var.web_memory
  desired_count       = var.web_desired_count
  min_capacity        = var.web_min_capacity
  max_capacity        = var.web_max_capacity
  subnet_ids          = module.network.private_app_subnet_ids
  security_group_ids  = [module.security.web_ecs_security_group_id]
  target_group_arn    = module.web_alb.target_group_arn
  log_retention_days  = var.log_retention_in_days
  secret_arns         = []
  environment_variables = {
    PORT                = tostring(var.web_container_port)
    NODE_ENV            = "production"
    HOSTNAME            = "0.0.0.0"
    NEXT_PUBLIC_API_URL = "https://${local.api_domain_name}/api/v1"
  }
  secrets                           = {}
  health_check_grace_period_seconds = 60
  tags                              = local.common_tags
}

module "web_cdn" {
  source = "./modules/cloudfront"

  name              = "${local.name_prefix}-web"
  alias_domain_name = local.app_domain_name
  certificate_arn   = module.web_certificate.certificate_arn
  origin_domain_name = module.web_alb.dns_name
  tags               = local.common_tags
}

module "dns" {
  source = "./modules/dns"

  zone_name           = local.hosted_zone_name
  app_record_name     = local.app_domain_name
  app_target_name     = module.web_cdn.domain_name
  app_target_zone_id  = module.web_cdn.hosted_zone_id
  api_record_name     = local.api_domain_name
  api_target_name     = module.api_alb.dns_name
  api_target_zone_id  = module.api_alb.zone_id
}
