output "app_id" {
  description = "Amplify app ID"
  value       = aws_amplify_app.frontend.id
}

output "default_domain" {
  description = "Default Amplify domain"
  value       = aws_amplify_app.frontend.default_domain
}

output "app_arn" {
  description = "Amplify app ARN"
  value       = aws_amplify_app.frontend.arn
}
