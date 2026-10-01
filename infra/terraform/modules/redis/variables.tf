variable "name_prefix" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "node_type" { type = string }
variable "replica_count" { type = number }
variable "auth_token" {
  type      = string
  sensitive = true
}
variable "tags" { type = map(string) }
