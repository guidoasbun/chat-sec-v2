output "cloudfront_url" {
  description = "The HTTPS URL for the frontend"
  value = "https://${var.domain_name}"
}

output "api_url" {
  description = "The HTTPS URL for the backend API"
  value = "https://api.${var.domain_name}"
}

output "ecr_repo_url" {
  description = "ECR repository URL for pushing Docker images"
  value       = module.ecs.ecr_repo_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito App Client ID"
  value       = module.cognito.client_id
}

output "alb_dns_name" {
  description = "Raw ALB DNS name"
  value       = module.ecs.alb_dns_name
}

output "deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC"
  value       = module.iam.deploy_role_arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (needed for cache invalidation)"
  value       = module.cloudfront.distribution_id
}

