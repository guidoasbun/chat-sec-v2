variable "app_name" {
  description = "App name prefix"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID to deploy Redis into"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the Redis subnet group"
  type        = list(string)
}
