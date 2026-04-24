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
