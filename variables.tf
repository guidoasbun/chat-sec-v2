variable "aws_region" {
  description = "AWS region for all resources"
  type = string
  default = "us-east-1"
}

variable "app_name" {
  description = "Short name used to prefix all resource names"
  type = string
  default = "chat-sec"
}

variable "domain_name" {
  description = "Root domain name"
  type = string
  default = "chat-secure.com"
}

variable "aws_account_info" {
  description = "AWS account ID"
  type = string
}

variable "github_org" {
  description = "Github username"
  type = string
}

variable "environment" {
  description = "Deployment environment label (prod, staging, dev)"
  type = string
  default = "prod"
}