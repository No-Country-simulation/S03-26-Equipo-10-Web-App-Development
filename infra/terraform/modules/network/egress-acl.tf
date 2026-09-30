# La ACL es stateless. Las excepciones para respuestas de ALB y PostgreSQL
# preceden las denegaciones de redes internas. Los security groups siguen
# restringiendo qué servicio puede iniciar cada conexión.
locals {
  blocked_app_egress = {
    "0.0.0.0/8"      = 130
    "10.0.0.0/8"     = 131
    "100.64.0.0/10"  = 132
    "127.0.0.0/8"    = 133
    "169.254.0.0/16" = 134
    "172.16.0.0/12"  = 135
    "192.168.0.0/16" = 136
    "198.18.0.0/15"  = 137
    "224.0.0.0/4"    = 138
    "240.0.0.0/4"    = 139
  }
}

resource "aws_network_acl" "private_app" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-private-app-egress-acl" })
}

resource "aws_network_acl_rule" "app_in_web_alb" {
  for_each       = local.az_map
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = 100 + index(var.availability_zones, each.key)
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = each.value.public_cidr
  from_port      = var.web_container_port
  to_port        = var.web_container_port
}

resource "aws_network_acl_rule" "app_in_api_alb" {
  for_each       = local.az_map
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = 110 + index(var.availability_zones, each.key)
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = each.value.public_cidr
  from_port      = var.api_container_port
  to_port        = var.api_container_port
}

resource "aws_network_acl_rule" "app_in_tcp_responses" {
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = 120
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 1024
  to_port        = 65535
}

resource "aws_network_acl_rule" "app_in_udp_responses" {
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = 121
  egress         = false
  protocol       = "udp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 1024
  to_port        = 65535
}

resource "aws_network_acl_rule" "app_out_alb_responses" {
  for_each       = local.az_map
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = 100 + index(var.availability_zones, each.key)
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = each.value.public_cidr
  from_port      = 1024
  to_port        = 65535
}

resource "aws_network_acl_rule" "app_out_postgres" {
  for_each       = local.az_map
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = 110 + index(var.availability_zones, each.key)
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = each.value.private_db_cidr
  from_port      = var.db_port
  to_port        = var.db_port
}

resource "aws_network_acl_rule" "app_out_dns_udp" {
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = 120
  egress         = true
  protocol       = "udp"
  rule_action    = "allow"
  cidr_block     = "${cidrhost(var.vpc_cidr, 2)}/32"
  from_port      = 53
  to_port        = 53
}

resource "aws_network_acl_rule" "app_out_dns_tcp" {
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = 121
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "${cidrhost(var.vpc_cidr, 2)}/32"
  from_port      = 53
  to_port        = 53
}

resource "aws_network_acl_rule" "app_out_block_internal" {
  for_each       = local.blocked_app_egress
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = each.value
  egress         = true
  protocol       = "-1"
  rule_action    = "deny"
  cidr_block     = each.key
}

resource "aws_network_acl_rule" "app_out_public" {
  network_acl_id = aws_network_acl.private_app.id
  rule_number    = 200
  egress         = true
  protocol       = "-1"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
}

# Crear todas las reglas antes de asociar la ACL; una ACL vacía deniega todo.
resource "aws_network_acl_association" "private_app" {
  for_each       = aws_subnet.private_app
  subnet_id      = each.value.id
  network_acl_id = aws_network_acl.private_app.id

  depends_on = [
    aws_network_acl_rule.app_in_web_alb,
    aws_network_acl_rule.app_in_api_alb,
    aws_network_acl_rule.app_in_tcp_responses,
    aws_network_acl_rule.app_in_udp_responses,
    aws_network_acl_rule.app_out_alb_responses,
    aws_network_acl_rule.app_out_postgres,
    aws_network_acl_rule.app_out_dns_udp,
    aws_network_acl_rule.app_out_dns_tcp,
    aws_network_acl_rule.app_out_block_internal,
    aws_network_acl_rule.app_out_public,
  ]
}
