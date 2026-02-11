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

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "alb_http_url" {
  description = "HTTP URL of the Application Load Balancer"
  value       = module.alb.alb_http_url
}

output "alb_https_url" {
  description = "HTTPS URL of the Application Load Balancer (requires certificate)"
  value       = module.alb.alb_https_url
}

output "certificate_validation_records" {
  description = "DNS records to add for SSL certificate validation"
  value       = var.api_domain_name != "" ? module.acm[0].validation_records : []
}

output "dns_configuration" {
  description = "DNS records to configure for your domain"
  value = var.api_domain_name != "" ? {
    api_domain = {
      name  = var.api_domain_name
      type  = "CNAME"
      value = module.alb.alb_dns_name
    }
    frontend_domain = var.frontend_domain_name != "" ? {
      name  = var.frontend_domain_name
      type  = "CNAME"
      value = module.amplify.default_domain
    } : null
  } : null
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
     - NEXT_PUBLIC_API_URL: ${var.api_domain_name != "" ? "https://${var.api_domain_name}" : module.alb.alb_http_url}
     - NEXT_PUBLIC_SOCKET_URL: ${var.api_domain_name != "" ? "https://${var.api_domain_name}" : module.alb.alb_http_url}
  
  5. Deploy backend (see docs/DEPLOYMENT.md)
  
  Frontend URL: https://${module.amplify.default_domain}
  Backend URL (ALB): ${var.api_domain_name != "" ? "https://${var.api_domain_name}" : module.alb.alb_http_url}
  Backend URL (Direct EC2): http://${module.ec2.public_ip}:3001
  
  ${var.api_domain_name != "" ? "🔐 SSL Certificate Configuration:\nAdd these DNS records to validate your certificate:\n${join("\n", [for record in module.acm[0].validation_records : "  ${record.type} ${record.name} → ${record.value}"])}\n\nThen add this CNAME record to point your API domain to ALB:\n  CNAME ${var.api_domain_name} → ${module.alb.alb_dns_name}\n" : "⚠️  IMPORTANT - Mixed Content Security:\nThe ALB currently uses HTTP. For production HTTPS:\n1. Get a custom domain name\n2. Update terraform.tfvars with api_domain_name\n3. Re-run terraform apply\n4. Add DNS validation records output by Terraform\n"}
  EOT
}
