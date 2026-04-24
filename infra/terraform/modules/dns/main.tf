data "aws_route53_zone" "this" {
  name         = "${trimsuffix(var.zone_name, ".")}."
  private_zone = false
}

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.app_record_name
  type    = "A"

  alias {
    name                   = var.app_target_name
    zone_id                = var.app_target_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.api_record_name
  type    = "A"

  alias {
    name                   = var.api_target_name
    zone_id                = var.api_target_zone_id
    evaluate_target_health = true
  }
}
