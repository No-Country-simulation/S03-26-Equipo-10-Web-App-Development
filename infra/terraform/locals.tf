locals {
  hosted_zone_name = trimsuffix(coalesce(var.hosted_zone_name, var.root_domain), ".")
  app_domain_name  = "${var.app_subdomain}.${local.hosted_zone_name}"
  api_domain_name  = "${var.api_subdomain}.${local.hosted_zone_name}"
  name_prefix      = "${var.project_name}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "S03-26-Equipo-10-Web-App-Development"
    },
    var.tags,
  )

  database_url = format(
    "postgresql://%s:%s@%s:%d/%s?schema=public",
    module.database.master_username,
    urlencode(module.database.master_password),
    module.database.endpoint,
    module.database.port,
    module.database.db_name,
  )
}
