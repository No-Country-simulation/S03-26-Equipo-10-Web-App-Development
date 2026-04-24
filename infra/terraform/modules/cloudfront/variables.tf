variable "name" {
  type = string
}

variable "alias_domain_name" {
  type = string
}

variable "certificate_arn" {
  type = string
}

variable "origin_domain_name" {
  type = string
}

variable "tags" {
  type = map(string)
}
