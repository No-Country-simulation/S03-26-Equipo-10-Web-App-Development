variable "name_prefix" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "availability_zones" {
  type = list(string)
}

variable "public_subnet_cidrs" {
  type = list(string)

  validation {
    condition     = length(var.public_subnet_cidrs) == length(var.availability_zones)
    error_message = "public_subnet_cidrs must have one entry per availability zone."
  }
}

variable "private_app_subnet_cidrs" {
  type = list(string)

  validation {
    condition     = length(var.private_app_subnet_cidrs) == length(var.availability_zones)
    error_message = "private_app_subnet_cidrs must have one entry per availability zone."
  }
}

variable "private_db_subnet_cidrs" {
  type = list(string)

  validation {
    condition     = length(var.private_db_subnet_cidrs) == length(var.availability_zones)
    error_message = "private_db_subnet_cidrs must have one entry per availability zone."
  }
}

variable "tags" {
  type = map(string)
}
