data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "web_ecs" {
  name        = "${var.name_prefix}-web-ecs"
  description = "Allow traffic from the web ALB to the web service"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.web_container_port
    to_port         = var.web_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.web_alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-web-ecs-sg" })
}

resource "aws_security_group" "api_ecs" {
  name        = "${var.name_prefix}-api-ecs"
  description = "Allow traffic from the api ALB to the api service"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.api_container_port
    to_port         = var.api_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.api_alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-api-ecs-sg" })
}

resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-rds"
  description = "Allow PostgreSQL only from the api service"
  vpc_id      = var.vpc_id
  egress      = []

  ingress {
    from_port       = var.db_port
    to_port         = var.db_port
    protocol        = "tcp"
    security_groups = [aws_security_group.api_ecs.id]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-rds-sg" })
}

resource "aws_security_group" "web_alb" {
  name        = "${var.name_prefix}-web-alb"
  description = "Allow CloudFront to reach the web ALB over HTTP"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  egress {
    from_port       = var.web_container_port
    to_port         = var.web_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.web_ecs.id]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-web-alb-sg" })
}

resource "aws_security_group" "api_alb" {
  name        = "${var.name_prefix}-api-alb"
  description = "Allow public HTTPS access to the api ALB"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port       = var.api_container_port
    to_port         = var.api_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.api_ecs.id]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-api-alb-sg" })
}
