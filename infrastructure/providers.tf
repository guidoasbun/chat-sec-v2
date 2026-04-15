terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
        source = "hashicorp/aws"
        version = "~>5.0"
    }
  }
  backend "s3" {
    bucket         = "chat-sec-tfstate-412381751532"
    key            = "chat-sec-v2/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "chat-sec-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}

provider "aws" {
  alias = "us_east_1"
  region = "us-east-1"
}