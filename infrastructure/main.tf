module "vpc" {
  source   = "./modules/vpc"
  app_name = var.app_name
}

module "route53" {
  source = "./modules/route53"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
  domain_name       = var.domain_name
  alb_dns_name      = module.ecs.alb_dns_name
  alb_zone_id       = module.ecs.alb_zone_id
  cloudfront_domain = module.cloudfront.cloudfront_domain
}

module "cognito" {
  source      = "./modules/cognito"
  app_name    = var.app_name
  domain_name = var.domain_name
}

module "dynamodb" {
  source   = "./modules/dynamodb"
  app_name = var.app_name
}

module "s3" {
  source      = "./modules/s3"
  app_name    = var.app_name
  environment = var.environment
}

module "elasticache" {
  source             = "./modules/elasticache"
  app_name           = var.app_name
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
}

module "ecs" {
  source             = "./modules/ecs"
  app_name           = var.app_name
  aws_region         = var.aws_region
  aws_account_id     = var.aws_account_id
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  alb_cert_arn       = module.route53.alb_cert_arn
  redis_url          = module.elasticache.redis_url
  cognito_pool_id    = module.cognito.user_pool_id
  cognito_client_id     = module.cognito.client_id
  cognito_client_secret = module.cognito.client_secret
  domain_name        = var.domain_name
  dynamodb_kms_key_arn  = module.dynamodb.kms_key_arn
}

module "cloudfront" {
  source              = "./modules/cloudfront"
  app_name            = var.app_name
  domain_name         = var.domain_name
  cloudfront_cert_arn = module.route53.cloudfront_cert_arn
  frontend_bucket_id  = module.s3.frontend_bucket_id
  frontend_bucket_arn = module.s3.frontend_bucket_arn
}

module "iam" {
  source         = "./modules/iam"
  aws_account_id = var.aws_account_id
  github_org     = var.github_org
  github_repo    = var.github_repo
  app_name       = var.app_name
  aws_region     = var.aws_region
}

module "waf" {
  source   = "./modules/waf"
  app_name = var.app_name
  alb_arn  = module.ecs.alb_arn
}
