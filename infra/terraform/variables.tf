variable "project_name" {
  description = "Project slug used for resource names."
  type        = string
  default     = "testimonial-cms"
}

variable "environment" {
  description = "Target environment name."
  type        = string
}

variable "aws_region" {
  description = "AWS region for the workload."
  type        = string
  default     = "us-east-1"
}

variable "root_domain" {
  description = "Root public DNS domain."
  type        = string
}

variable "hosted_zone_name" {
  description = "Public Route53 hosted zone name. Defaults to root_domain."
  type        = string
  default     = null
  nullable    = true
}

variable "app_subdomain" {
  description = "Subdomain for the frontend."
  type        = string
}

variable "api_subdomain" {
  description = "Subdomain for the backend API."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "availability_zones" {
  description = "Availability zones used by the stack."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs, one per AZ."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "Private application subnet CIDRs, one per AZ."
  type        = list(string)
}

variable "private_db_subnet_cidrs" {
  description = "Private database subnet CIDRs, one per AZ."
  type        = list(string)
}

variable "web_image_tag" {
  description = "Image tag to deploy for the web service."
  type        = string
  default     = "latest"
}

variable "api_image_tag" {
  description = "Image tag to deploy for the api service."
  type        = string
  default     = "latest"
}

variable "webhook_legacy_http_started_at" {
  description = "UTC del primer despliegue compatible; habilita HTTP solo para destinos anteriores durante 30 días. Null lo deshabilita."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.webhook_legacy_http_started_at == null || can(regex("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$", var.webhook_legacy_http_started_at))
    error_message = "webhook_legacy_http_started_at must be a UTC timestamp such as 2026-09-30T12:00:00Z."
  }
}

variable "webhook_signature_legacy_started_at" {
  description = "UTC del primer despliegue con firmas versionadas; X-Signature y destinos sin firma vencen a los 30 días."
  type        = string
  default     = null
  nullable    = true
}

variable "webhook_secret_current_version" {
  description = "Versión actual de la clave AES-GCM para secretos de destinos webhook."
  type        = number
  default     = 1
  validation {
    condition     = var.webhook_secret_current_version >= 1
    error_message = "The webhook secret key version must be positive."
  }
}

variable "webhook_secret_keys_json" {
  description = "Mapa JSON de versiones a claves AES-256-GCM; inyectar desde almacén seguro."
  type        = string
  sensitive   = true
  validation {
    condition     = can(jsondecode(var.webhook_secret_keys_json))
    error_message = "The webhook secret keys must be a JSON object."
  }
}

variable "api_key_legacy_started_at" {
  description = "UTC del primer despliegue compatible de API keys; tms_ vence a los 30 días. Null lo bloquea en producción."
  type        = string
  default     = null
  nullable    = true
}

variable "api_key_pepper_current_version" {
  description = "Versión del pepper usado para emitir API keys nuevas."
  type        = number
  default     = 1
  validation {
    condition     = var.api_key_pepper_current_version >= 1
    error_message = "The API key pepper version must be positive."
  }
}

variable "api_key_peppers_json" {
  description = "Mapa JSON de versiones a peppers base64url; inyectar desde un almacén seguro, nunca desde tfvars versionados."
  type        = string
  sensitive   = true
  validation {
    condition     = can(jsondecode(var.api_key_peppers_json))
    error_message = "The API key peppers must be a JSON object."
  }
}

variable "web_container_port" {
  description = "Port exposed by the web container."
  type        = number
  default     = 3000
}

variable "api_container_port" {
  description = "Port exposed by the api container."
  type        = number
  default     = 4000
}

variable "web_cpu" {
  description = "CPU units for the web task."
  type        = number
  default     = 512
}

variable "web_memory" {
  description = "Memory in MiB for the web task."
  type        = number
  default     = 1024
}

variable "api_cpu" {
  description = "CPU units for the api task."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory in MiB for the api task."
  type        = number
  default     = 1024
}

variable "redis_node_type" {
  description = "ElastiCache Redis 7 node class."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_replica_count" {
  description = "Number of Redis replicas; production should use at least one."
  type        = number
  default     = 0
  validation {
    condition     = var.redis_replica_count >= 0 && var.redis_replica_count <= 5
    error_message = "redis_replica_count must be between 0 and 5."
  }
}

variable "web_desired_count" {
  description = "Desired task count for web."
  type        = number
}

variable "web_min_capacity" {
  description = "Minimum task count for web autoscaling."
  type        = number
}

variable "web_max_capacity" {
  description = "Maximum task count for web autoscaling."
  type        = number
}

variable "api_desired_count" {
  description = "Desired task count for api."
  type        = number
}

variable "api_min_capacity" {
  description = "Minimum task count for api autoscaling."
  type        = number
}

variable "api_max_capacity" {
  description = "Maximum task count for api autoscaling."
  type        = number
}

variable "web_health_check_path" {
  description = "ALB health check path for the web service."
  type        = string
  default     = "/health"
}

variable "api_health_check_path" {
  description = "ALB health check path for the api service."
  type        = string
  default     = "/api/v1/health"
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "testimonial_cms"
}

variable "db_master_username" {
  description = "Master username for PostgreSQL."
  type        = string
  default     = "app_admin"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB."
  type        = number
}

variable "db_max_allocated_storage" {
  description = "Maximum autoscaled storage in GB."
  type        = number
}

variable "db_backup_retention_period" {
  description = "Backup retention in days."
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Whether to deploy PostgreSQL in Multi-AZ mode."
  type        = bool
  default     = true
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on the DB instance."
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  description = "Skip final snapshot when destroying the DB."
  type        = bool
  default     = false
}

variable "jwt_secret" {
  description = "JWT secret used by the API."
  type        = string
  sensitive   = true
}

variable "cloudinary_upload_url" {
  description = "Cloudinary upload URL for the API."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloudinary_upload_preset" {
  description = "Cloudinary upload preset for the API."
  type        = string
  default     = ""
  sensitive   = true
}

variable "youtube_api_key" {
  description = "YouTube API key for metadata lookups."
  type        = string
  default     = ""
  sensitive   = true
}

variable "log_retention_in_days" {
  description = "CloudWatch log retention for ECS services."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Extra tags applied to all resources."
  type        = map(string)
  default     = {}
}
