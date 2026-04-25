#!/usr/bin/env bash
# Creates the three DynamoDB Local tables needed for local development.
# DynamoDB Local runs in-memory, so this must be re-run after every container restart.
#
# Usage:
#   ./scripts/init-dynamo-local.sh
#
# Prerequisites:
#   - AWS CLI installed  (brew install awscli)
#   - DynamoDB Local running  (docker compose up dynamodb-local -d)

set -euo pipefail

ENDPOINT="http://localhost:8000"
REGION="us-east-1"
AWS_CMD="aws --endpoint-url $ENDPOINT --region $REGION"

# Fake credentials are required by the CLI but ignored by DynamoDB Local
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

echo "Waiting for DynamoDB Local to be ready..."
until $AWS_CMD dynamodb list-tables &>/dev/null; do
  sleep 1
done
echo "DynamoDB Local is up."

# ── users ─────────────────────────────────────────────────────────────────────
echo "Creating table: users"
$AWS_CMD dynamodb create-table \
  --table-name users \
  --attribute-definitions \
      AttributeName=userId,AttributeType=S \
      AttributeName=username,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[{
    "IndexName": "username-index",
    "KeySchema": [{"AttributeName":"username","KeyType":"HASH"}],
    "Projection": {"ProjectionType":"ALL"}
  }]' \
  --query "TableDescription.TableName" \
  --output text

# ── chats ─────────────────────────────────────────────────────────────────────
echo "Creating table: chats"
$AWS_CMD dynamodb create-table \
  --table-name chats \
  --attribute-definitions AttributeName=chatId,AttributeType=S \
  --key-schema AttributeName=chatId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --query "TableDescription.TableName" \
  --output text

# ── messages ──────────────────────────────────────────────────────────────────
echo "Creating table: messages"
$AWS_CMD dynamodb create-table \
  --table-name messages \
  --attribute-definitions \
      AttributeName=chatId,AttributeType=S \
      AttributeName=timestamp,AttributeType=S \
  --key-schema \
      AttributeName=chatId,KeyType=HASH \
      AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --query "TableDescription.TableName" \
  --output text

echo ""
echo "All tables created:"
$AWS_CMD dynamodb list-tables --output text
