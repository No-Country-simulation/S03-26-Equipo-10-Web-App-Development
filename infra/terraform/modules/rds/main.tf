resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnets"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, { Name = "${var.name_prefix}-db-subnets" })
}

resource "aws_db_instance" "this" {
  identifier               = substr("${var.name_prefix}-postgres", 0, 63)
  engine                   = "postgres"
  instance_class           = var.instance_class
  allocated_storage        = var.allocated_storage
  max_allocated_storage    = var.max_allocated_storage
  storage_type             = "gp3"
  db_name                  = var.db_name
  username                 = var.master_username
  password                 = random_password.master.result
  db_subnet_group_name     = aws_db_subnet_group.this.name
  vpc_security_group_ids   = var.security_group_ids
  publicly_accessible      = false
  multi_az                 = var.multi_az
  backup_retention_period  = var.backup_retention_period
  deletion_protection      = var.deletion_protection
  skip_final_snapshot      = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name_prefix}-final"
  apply_immediately        = false
  auto_minor_version_upgrade = true
  storage_encrypted        = true
  copy_tags_to_snapshot    = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-postgres" })
}
