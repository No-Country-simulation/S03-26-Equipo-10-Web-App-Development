output "web_alb_security_group_id" {
  value = aws_security_group.web_alb.id
}

output "api_alb_security_group_id" {
  value = aws_security_group.api_alb.id
}

output "web_ecs_security_group_id" {
  value = aws_security_group.web_ecs.id
}

output "api_ecs_security_group_id" {
  value = aws_security_group.api_ecs.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}
