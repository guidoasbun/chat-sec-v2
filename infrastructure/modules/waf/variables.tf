variable "app_name" {
  description = "App name prefix for resource naming"
  type        = string
}

variable "alb_arn" {
  description = "ALB ARN to attach the WAF WebACL to"
  type        = string
}
