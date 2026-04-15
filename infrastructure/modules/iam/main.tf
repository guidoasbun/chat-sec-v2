# ── GitHub OIDC Provider ──────────────────────────────────────────────────────

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# ── GitHub Actions Deploy Role ────────────────────────────────────────────────

resource "aws_iam_role" "github_deploy" {
  name = "${var.app_name}-github-deploy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"
        }
      }
    }]
  })
}

# ── Deploy Role Permissions ───────────────────────────────────────────────────

resource "aws_iam_role_policy" "deploy" {
  name = "${var.app_name}-deploy-policy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${var.aws_account_id}:repository/${var.app_name}-api"
      },
      {
        Sid    = "ECSUpdate"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = [
          "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:cluster/${var.app_name}-cluster",
          "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:service/${var.app_name}-cluster/${var.app_name}-api",
          "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:task-definition/${var.app_name}-api:*"
        ]
      },
      {
        Sid    = "PassTaskRoles"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          "arn:aws:iam::${var.aws_account_id}:role/${var.app_name}-ecs-execution-role",
          "arn:aws:iam::${var.aws_account_id}:role/${var.app_name}-ecs-task-role"
        ]
      },
      {
        Sid    = "S3Frontend"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.app_name}-frontend-prod",
          "arn:aws:s3:::${var.app_name}-frontend-prod/*"
        ]
      },
      {
        Sid    = "CloudFrontInvalidate"
        Effect = "Allow"
        Action = "cloudfront:CreateInvalidation"
        Resource = "*"
      }
    ]
  })
}
