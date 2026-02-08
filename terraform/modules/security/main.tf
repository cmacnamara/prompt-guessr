# Security Groups Module - Firewall Rules

# Fetch GitHub's IP ranges for Actions runners
data "http" "github_meta" {
  url = "https://api.github.com/meta"
}

locals {
  github_meta = jsondecode(data.http.github_meta.response_body)
  # GitHub Actions uses "actions" IP ranges
  github_actions_ips = local.github_meta.actions
}

# EC2 Security Group (Backend Server)
resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-${var.environment}-ec2-sg"
  description = "Security group for backend EC2 instance"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-${var.environment}-ec2-sg"
  }
}

# EC2 Inbound Rules
resource "aws_security_group_rule" "ec2_http" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "HTTP from anywhere"
  security_group_id = aws_security_group.ec2.id
}

resource "aws_security_group_rule" "ec2_https" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "HTTPS from anywhere"
  security_group_id = aws_security_group.ec2.id
}

resource "aws_security_group_rule" "ec2_backend_api" {
  type              = "ingress"
  from_port         = 3001
  to_port           = 3001
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Backend API and Socket.IO from anywhere"
  security_group_id = aws_security_group.ec2.id
}

resource "aws_security_group_rule" "ec2_ssh" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = [var.allowed_ssh_cidr]
  description       = "SSH from personal IP"
  security_group_id = aws_security_group.ec2.id
}

# SSH from GitHub Actions for deployment (dynamically fetched IP ranges)
resource "aws_security_group_rule" "ec2_ssh_github_actions" {
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = local.github_actions_ips
  description       = "SSH from GitHub Actions for CI/CD deployments"
  security_group_id = aws_security_group.ec2.id
}

# EC2 Outbound Rule (allow all)
resource "aws_security_group_rule" "ec2_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound traffic"
  security_group_id = aws_security_group.ec2.id
}

# ElastiCache Security Group
resource "aws_security_group" "elasticache" {
  name        = "${var.project_name}-${var.environment}-elasticache-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-${var.environment}-elasticache-sg"
  }
}

# ElastiCache Inbound Rule (Redis port from EC2 only)
resource "aws_security_group_rule" "elasticache_redis" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ec2.id
  description              = "Redis from EC2 instances only"
  security_group_id        = aws_security_group.elasticache.id
}

# ElastiCache Outbound Rule
resource "aws_security_group_rule" "elasticache_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound traffic"
  security_group_id = aws_security_group.elasticache.id
}
