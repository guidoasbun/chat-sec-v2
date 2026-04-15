# ── KMS Key for encryption at rest ───────────────────────────────────────────

resource "aws_kms_key" "dynamodb" {
  description             = "KMS key for DynamoDB encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "${var.app_name}-dynamodb-key"
  }
}

resource "aws_kms_alias" "dynamodb" {
  name          = "alias/${var.app_name}-dynamodb"
  target_key_id = aws_kms_key.dynamodb.key_id
}

# ── Users table ───────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "users" {
  name         = "${var.app_name}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "username"
    type = "S"
  }

  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }

  tags = {
    Name = "${var.app_name}-users"
  }
}

# ── Chats table ───────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "chats" {
  name         = "${var.app_name}-chats"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "chatId"

  attribute {
    name = "chatId"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }

  tags = {
    Name = "${var.app_name}-chats"
  }
}

# ── Messages table ────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "messages" {
  name         = "${var.app_name}-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "chatId"
  range_key    = "timestamp"

  attribute {
    name = "chatId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }

  tags = {
    Name = "${var.app_name}-messages"
  }
}
