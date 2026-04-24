variable "aws_region" {
  description = "Region where the state backend resources live."
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Name of the S3 bucket for remote state."
  type        = string
  default     = "testimonial-cms-terraform-state"
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table used for state locking."
  type        = string
  default     = "testimonial-cms-terraform-locks"
}

variable "tags" {
  description = "Extra tags for backend resources."
  type        = map(string)
  default = {
    Project   = "testimonial-cms"
    ManagedBy = "terraform"
  }
}
