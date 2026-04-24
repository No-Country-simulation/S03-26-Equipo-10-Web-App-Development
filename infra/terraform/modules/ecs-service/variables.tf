variable "cluster_arn" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "service_name" {
  type = string
}

variable "container_name" {
  type = string
}

variable "container_image" {
  type = string
}

variable "container_port" {
  type = number
}

variable "cpu" {
  type = number
}

variable "memory" {
  type = number
}

variable "desired_count" {
  type = number
}

variable "min_capacity" {
  type = number
}

variable "max_capacity" {
  type = number
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_ids" {
  type = list(string)
}

variable "target_group_arn" {
  type = string
}

variable "environment_variables" {
  type    = map(string)
  default = {}
}

variable "secrets" {
  type    = map(string)
  default = {}
}

variable "secret_arns" {
  type    = list(string)
  default = []
}

variable "log_retention_days" {
  type = number
}

variable "assign_public_ip" {
  type    = bool
  default = false
}

variable "health_check_grace_period_seconds" {
  type    = number
  default = 60
}

variable "tags" {
  type = map(string)
}
