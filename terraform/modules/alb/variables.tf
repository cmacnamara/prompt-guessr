variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where ALB will be created"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for ALB"
  type        = list(string)
}

variable "ec2_instance_id" {
  description = "EC2 instance ID to register as target"
  type        = string
}

variable "backend_port" {
  description = "Port on which backend application runs"
  type        = number
  default     = 3001
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (optional - if not provided, only HTTP listener is created)"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Custom domain name for the ALB (optional)"
  type        = string
  default     = ""
}
