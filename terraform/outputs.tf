output "ec2_public_ip" {
  description = "Public IP address of EC2 instance (backend server)"
  value       = module.ec2.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = module.ec2.instance_id
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint URL"
  value       = module.elasticache.redis_endpoint
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = module.elasticache.redis_port
}

output "s3_bucket_name" {
  description = "S3 bucket name for image storage"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.s3.bucket_arn
}

output "amplify_app_id" {
  description = "AWS Amplify app ID"
  value       = module.amplify.app_id
}

output "amplify_default_domain" {
  description = "Default Amplify domain for frontend"
  value       = module.amplify.default_domain
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "deployment_instructions" {
  description = "Next steps after Terraform apply"
  value       = <<-EOT
  
  ✅ Infrastructure created successfully!
  
  Next steps:
  
  1. SSH to EC2 instance:
     ssh -i ~/.ssh/${var.ssh_key_name}.pem ec2-user@${module.ec2.public_ip}
  
  2. Update GitHub Secrets with these values:
     - EC2_HOST: ${module.ec2.public_ip}
     - REDIS_URL: redis://${module.elasticache.redis_endpoint}:${module.elasticache.redis_port}
     - S3_BUCKET_NAME: ${module.s3.bucket_name}
  
  3. Configure backend .env on EC2:
     REDIS_URL=redis://${module.elasticache.redis_endpoint}:${module.elasticache.redis_port}
     CORS_ORIGIN=https://${module.amplify.default_domain}
  
  4. Update Amplify environment variables:
     - NEXT_PUBLIC_API_URL: http://${module.ec2.public_ip}:3001
     - NEXT_PUBLIC_SOCKET_URL: http://${module.ec2.public_ip}:3001
  
  5. Deploy backend (see docs/DEPLOYMENT.md)
  
  Frontend URL: https://${module.amplify.default_domain}
  Backend URL: http://${module.ec2.public_ip}:3001
  
  EOT
}
