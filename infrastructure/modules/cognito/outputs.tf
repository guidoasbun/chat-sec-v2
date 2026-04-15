output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "client_id" {
  description = "Cognito App Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "client_secret" {
  description = "Cognito App Client Secret"
  value       = aws_cognito_user_pool_client.main.client_secret
  sensitive   = true
}

output "user_pool_endpoint" {
  description = "Cognito User Pool endpoint (used to validate JWTs)"
  value       = aws_cognito_user_pool.main.endpoint
}
