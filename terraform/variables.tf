variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "prompt-guessr"
}

variable "environment" {
  description = "Environment name (production, staging, etc.)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "ssh_key_name" {
  description = "Name of the SSH key pair in AWS for EC2 access"
  type        = string
  # Set via TF_VAR_ssh_key_name environment variable or terraform.tfvars
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH to EC2 instance (your IP)"
  type        = string
  # Set via TF_VAR_allowed_ssh_cidr environment variable
  # Example: "203.0.113.50/32"
}

variable "github_repository" {
  description = "GitHub repository in format owner/repo"
  type        = string
  # Example: "yourusername/prompt-guessr"
}

variable "github_token" {
  description = "GitHub personal access token for Amplify"
  type        = string
  sensitive   = true
  # Generate at: https://github.com/settings/tokens
  # Required scopes: repo, admin:repo_hook
}

variable "api_domain_name" {
  description = "Domain name for the backend API (e.g., api.prompt-guessr.com)"
  type        = string
  default     = ""
  # Leave empty to skip SSL certificate creation
}

variable "frontend_domain_name" {
  description = "Domain name for the frontend (e.g., prompt-guessr.com or www.prompt-guessr.com)"
  type        = string
  default     = ""
  # Leave empty to use Amplify's default domain
}
