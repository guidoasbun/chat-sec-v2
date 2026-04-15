output "media_bucket_name" {
  description = "Name of the media storage bucket"
  value       = aws_s3_bucket.media.id
}

output "media_bucket_arn" {
  description = "ARN of the media storage bucket"
  value       = aws_s3_bucket.media.arn
}

output "frontend_bucket_id" {
  description = "ID of the frontend static hosting bucket"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_bucket_arn" {
  description = "ARN of the frontend static hosting bucket"
  value       = aws_s3_bucket.frontend.arn
}
