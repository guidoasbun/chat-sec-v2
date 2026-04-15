output "alb_dns_name" {
  description = "ALB DNS name for Route 53 alias record"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID for Route 53 alias record"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ALB ARN for WAF attachment"
  value       = aws_lb.main.arn
}

output "ecr_repo_url" {
  description = "ECR repository URL for Docker image pushes"
  value       = aws_ecr_repository.main.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.main.name
}
