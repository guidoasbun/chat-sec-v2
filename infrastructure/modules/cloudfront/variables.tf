variable "app_name" {
  description = "App name prefix for resource naming"
  type        = string
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
}

variable "cloudfront_cert_arn" {
  description = "ACM certificate ARN in us-east-1 for CloudFront"
  type        = string
}

variable "frontend_bucket_id" {
  description = "S3 frontend bucket ID (name)"
  type        = string
}

variable "frontend_bucket_arn" {
  description = "S3 frontend bucket ARN"
  type        = string
}
