variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "web_container_port" {
  type = number
}

variable "api_container_port" {
  type = number
}

variable "db_port" {
  type = number
}

variable "tags" {
  type = map(string)
}
