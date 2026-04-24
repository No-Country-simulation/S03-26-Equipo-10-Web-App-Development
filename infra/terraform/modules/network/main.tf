locals {
  az_map = {
    for index, az in var.availability_zones :
    az => {
      public_cidr      = var.public_subnet_cidrs[index]
      private_app_cidr = var.private_app_subnet_cidrs[index]
      private_db_cidr  = var.private_db_subnet_cidrs[index]
    }
  }
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  for_each = local.az_map

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = each.value.public_cidr
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${each.key}"
    Tier = "public"
  })
}

resource "aws_subnet" "private_app" {
  for_each = local.az_map

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = each.value.private_app_cidr

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-app-${each.key}"
    Tier = "private-app"
  })
}

resource "aws_subnet" "private_db" {
  for_each = local.az_map

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = each.value.private_db_cidr

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-db-${each.key}"
    Tier = "private-db"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-public-rt" })
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  for_each = local.az_map

  domain = "vpc"

  tags = merge(var.tags, { Name = "${var.name_prefix}-nat-eip-${each.key}" })
}

resource "aws_nat_gateway" "this" {
  for_each = local.az_map

  subnet_id     = aws_subnet.public[each.key].id
  allocation_id = aws_eip.nat[each.key].id

  depends_on = [aws_internet_gateway.this]

  tags = merge(var.tags, { Name = "${var.name_prefix}-nat-${each.key}" })
}

resource "aws_route_table" "private_app" {
  for_each = local.az_map

  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[each.key].id
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-private-app-rt-${each.key}" })
}

resource "aws_route_table_association" "private_app" {
  for_each = local.az_map

  subnet_id      = aws_subnet.private_app[each.key].id
  route_table_id = aws_route_table.private_app[each.key].id
}

resource "aws_route_table" "private_db" {
  for_each = local.az_map

  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[each.key].id
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-private-db-rt-${each.key}" })
}

resource "aws_route_table_association" "private_db" {
  for_each = local.az_map

  subnet_id      = aws_subnet.private_db[each.key].id
  route_table_id = aws_route_table.private_db[each.key].id
}
