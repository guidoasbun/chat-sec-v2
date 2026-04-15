variable "app_name" {
  description = "App name prefix for resource naming"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "alb_cert_arn" {
  description = "ACM certificate ARN for the ALB HTTPS listener"
  type        = string
}

variable "redis_url" {
  description = "Redis connection URL for SignalR backplane"
  type        = string
}

variable "cognito_pool_id" {
  description = "Cognito User Pool ID for JWT validation"
  type        = string
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
}
