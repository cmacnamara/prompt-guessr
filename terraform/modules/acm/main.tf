# ACM Certificate for SSL/TLS
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-cert-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
  }
}

# Output the DNS validation records
# You'll need to add these to your domain's DNS settings
output "certificate_validation_records" {
  description = "DNS records needed for certificate validation"
  value = [
    for dvo in aws_acm_certificate.main.domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ]
}
