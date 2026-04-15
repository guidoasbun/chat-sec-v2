output "users_table_name" {
  description = "DynamoDB users table name"
  value       = aws_dynamodb_table.users.name
}

output "chats_table_name" {
  description = "DynamoDB chats table name"
  value       = aws_dynamodb_table.chats.name
}

output "messages_table_name" {
  description = "DynamoDB messages table name"
  value       = aws_dynamodb_table.messages.name
}

output "kms_key_arn" {
  description = "KMS key ARN for DynamoDB encryption"
  value       = aws_kms_key.dynamodb.arn
}
