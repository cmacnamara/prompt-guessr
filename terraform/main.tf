terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state backend (S3 + DynamoDB for locking)
  # You must create these resources manually first:
  # 1. S3 bucket for state storage
  # 2. DynamoDB table for state locking
  backend "s3" {
    bucket         = "prompt-guessr-terraform-state-1770526945"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "prompt-guessr"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
}

# Security Groups Module
module "security" {
  source = "./modules/security"

  vpc_id           = module.vpc.vpc_id
  project_name     = var.project_name
  environment      = var.environment
  allowed_ssh_cidr = var.allowed_ssh_cidr
  # Don't pass ALB security group here - circular dependency
}

# EC2 Module
module "ec2" {
  source = "./modules/ec2"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_id  = module.vpc.public_subnet_ids[0]
  security_group_id = module.security.ec2_security_group_id
  ssh_key_name      = var.ssh_key_name
}

# ElastiCache Redis Module
module "elasticache" {
  source = "./modules/elasticache"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_id  = module.security.elasticache_security_group_id
}

# S3 Module
module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
}

# ACM Certificate Module (for HTTPS)
# Only created if api_domain_name is provided
module "acm" {
  count  = var.api_domain_name != "" ? 1 : 0
  source = "./modules/acm"

  domain_name = var.api_domain_name
  # Also include wildcard subdomain
  subject_alternative_names = ["*.${var.api_domain_name}"]
  project_name              = var.project_name
  environment               = var.environment
}

# Application Load Balancer Module (created after EC2)
module "alb" {
  source = "./modules/alb"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  ec2_instance_id   = module.ec2.instance_id
  backend_port      = 3001

  # Use certificate if domain is provided
  certificate_arn = var.api_domain_name != "" ? module.acm[0].certificate_arn : ""
  domain_name     = var.api_domain_name
}

# Add security group rule for ALB -> EC2 traffic (after ALB is created)
resource "aws_security_group_rule" "ec2_backend_from_alb" {
  type                     = "ingress"
  from_port                = 3001
  to_port                  = 3001
  protocol                 = "tcp"
  source_security_group_id = module.alb.alb_security_group_id
  description              = "Backend API from ALB"
  security_group_id        = module.security.ec2_security_group_id
}

# Amplify Module
module "amplify" {
  source = "./modules/amplify"

  project_name      = var.project_name
  environment       = var.environment
  github_repository = var.github_repository
  github_token      = var.github_token
  # Use HTTPS URL if domain is configured, otherwise HTTP
  backend_url = var.api_domain_name != "" ? "https://${var.api_domain_name}" : module.alb.alb_http_url
}
