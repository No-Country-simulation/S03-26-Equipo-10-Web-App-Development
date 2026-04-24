variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "target_port" {
  type = number
}

variable "health_check_path" {
  type = string
}

variable "enable_https" {
  type = bool
}

variable "certificate_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "deletion_protection" {
  type = bool
}

variable "tags" {
  type = map(string)
}
