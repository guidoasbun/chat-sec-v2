output "cloudfront_domain" {
  description = "CloudFront distribution domain name (for Route 53 alias)"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation in CI/CD)"
  value       = aws_cloudfront_distribution.main.id
}
