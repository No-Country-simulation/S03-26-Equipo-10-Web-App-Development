variable "name" {
  type = string
}

variable "description" {
  type = string
}

variable "secret_values" {
  type      = map(string)
  sensitive = true
}

variable "tags" {
  type = map(string)
}
