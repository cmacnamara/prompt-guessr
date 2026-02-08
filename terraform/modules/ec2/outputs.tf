output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.backend.id
}

output "public_ip" {
  description = "Elastic IP address"
  value       = aws_eip.backend.public_ip
}

output "private_ip" {
  description = "Private IP address"
  value       = aws_instance.backend.private_ip
}
