output "alb_id" {
  description = "ID of the Application Load Balancer"
  value       = aws_lb.main.id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

output "alb_http_url" {
  description = "HTTP URL of the Application Load Balancer"
  value       = "http://${aws_lb.main.dns_name}"
}

output "alb_https_url" {
  description = "HTTPS URL of the Application Load Balancer (requires certificate)"
  value       = var.certificate_arn != "" ? "https://${var.domain_name != "" ? var.domain_name : aws_lb.main.dns_name}" : "Certificate required for HTTPS"
}

output "target_group_arn" {
  description = "ARN of the backend target group"
  value       = aws_lb_target_group.backend.arn
}

output "alb_security_group_id" {
  description = "Security group ID for the ALB"
  value       = aws_security_group.alb.id
}
