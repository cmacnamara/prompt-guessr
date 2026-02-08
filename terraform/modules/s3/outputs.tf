output "bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.images.id
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.images.arn
}

output "bucket_domain_name" {
  description = "S3 bucket domain name"
  value       = aws_s3_bucket.images.bucket_domain_name
}
