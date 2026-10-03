# ECS emits structured outbox.health and http.server_error records. These filters
# provide CloudWatch alarms without adding Redis or another delivery queue.
resource "aws_sns_topic" "api_alerts" {
  name = "${local.name_prefix}-api-alerts"
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "api_alert_email" {
  count     = var.alert_notification_email == null ? 0 : 1
  topic_arn = aws_sns_topic.api_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_notification_email
}

resource "aws_cloudwatch_log_metric_filter" "dead_deliveries" {
  name           = "${local.name_prefix}-dead-deliveries"
  log_group_name = "/ecs/${local.name_prefix}-api"
  pattern        = "{ $.event = \"outbox.health\" }"

  metric_transformation {
    name          = "DeadDeliveries"
    namespace     = "TestimonialCMS/${var.environment}"
    value         = "$.deadDeliveries"
    default_value = "0"
  }

  depends_on = [module.api_service]
}

resource "aws_cloudwatch_log_metric_filter" "oldest_pending" {
  name           = "${local.name_prefix}-oldest-pending"
  log_group_name = "/ecs/${local.name_prefix}-api"
  pattern        = "{ $.event = \"outbox.health\" }"

  metric_transformation {
    name          = "OldestPendingAgeSeconds"
    namespace     = "TestimonialCMS/${var.environment}"
    value         = "$.oldestPendingAgeSeconds"
    default_value = "0"
  }

  depends_on = [module.api_service]
}

resource "aws_cloudwatch_log_metric_filter" "server_errors" {
  name           = "${local.name_prefix}-server-errors"
  log_group_name = "/ecs/${local.name_prefix}-api"
  pattern        = "{ $.event = \"http.server_error\" }"

  metric_transformation {
    name          = "HttpServerErrors"
    namespace     = "TestimonialCMS/${var.environment}"
    value         = "1"
    default_value = "0"
  }

  depends_on = [module.api_service]
}

resource "aws_cloudwatch_log_metric_filter" "poll_failures" {
  name           = "${local.name_prefix}-outbox-poll-failures"
  log_group_name = "/ecs/${local.name_prefix}-api"
  pattern        = "{ $.event = \"outbox.poll_failed\" }"

  metric_transformation {
    name          = "OutboxPollFailures"
    namespace     = "TestimonialCMS/${var.environment}"
    value         = "1"
    default_value = "0"
  }

  depends_on = [module.api_service]
}

resource "aws_cloudwatch_metric_alarm" "dead_deliveries" {
  alarm_name          = "${local.name_prefix}-dead-deliveries"
  alarm_description   = "At least one webhook delivery needs administrative action"
  namespace           = "TestimonialCMS/${var.environment}"
  metric_name         = "DeadDeliveries"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.api_alerts.arn]
  tags                = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "oldest_pending" {
  alarm_name          = "${local.name_prefix}-oldest-pending"
  alarm_description   = "Oldest outbox event has been pending over five minutes"
  namespace           = "TestimonialCMS/${var.environment}"
  metric_name         = "OldestPendingAgeSeconds"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  datapoints_to_alarm = 5
  threshold           = 300
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.api_alerts.arn]
  tags                = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "sustained_server_errors" {
  alarm_name          = "${local.name_prefix}-sustained-5xx"
  alarm_description   = "Five or more API 5xx responses per minute for three of five minutes"
  namespace           = "TestimonialCMS/${var.environment}"
  metric_name         = "HttpServerErrors"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 5
  datapoints_to_alarm = 3
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.api_alerts.arn]
  tags                = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "poll_failures" {
  alarm_name          = "${local.name_prefix}-outbox-poll-failures"
  alarm_description   = "Three failed outbox polls in five minutes"
  namespace           = "TestimonialCMS/${var.environment}"
  metric_name         = "OutboxPollFailures"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 3
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.api_alerts.arn]
  tags                = local.common_tags
}
