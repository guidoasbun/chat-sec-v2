variable "domain_name" {
  description = "Root domain name (e.g. chat-secure.com)"
  type        = string
}

variable "alb_dns_name" {
  description = "DNS name of the ALB (from ecs module)"
  type        = string
}

variable "alb_zone_id" {
  description = "Hosted zone ID of the ALB (from ecs module)"
  type        = string
}

variable "cloudfront_domain" {
  description = "CloudFront distribution domain name (from cloudfront module)"
  type        = string
}
