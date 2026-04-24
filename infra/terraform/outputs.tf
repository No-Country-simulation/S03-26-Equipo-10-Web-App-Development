output "app_url" {
  description = "Public URL for the frontend."
  value       = "https://${local.app_domain_name}"
}

output "api_url" {
  description = "Public URL for the API."
  value       = "https://${local.api_domain_name}"
}

output "web_ecr_repository_url" {
  description = "ECR repository URL for the web image."
  value       = module.ecr.web_repository_url
}

output "api_ecr_repository_url" {
  description = "ECR repository URL for the api image."
  value       = module.ecr.api_repository_url
}

output "ecs_cluster_name" {
  description = "Shared ECS cluster name."
  value       = module.ecs_cluster.cluster_name
}

output "db_endpoint" {
  description = "RDS endpoint address."
  value       = module.database.endpoint
}

output "api_migration_task" {
  description = "Values required to run Prisma migrations as a one-off ECS task."
  value = {
    cluster_name       = module.ecs_cluster.cluster_name
    task_definition_arn = module.api_service.task_definition_arn
    subnet_ids         = module.network.private_app_subnet_ids
    security_group_ids = [module.security.api_ecs_security_group_id]
    container_name     = "api"
    command            = ["npm", "run", "db:migrate", "--workspace", "@testimonial-cms/api"]
  }
}
