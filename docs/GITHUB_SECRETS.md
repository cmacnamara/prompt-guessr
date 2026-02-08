# GitHub Secrets Configuration Guide

This document lists all required GitHub Secrets for automated deployment workflows.

## How to Add Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret listed below

---

## Required Secrets

### AWS Credentials

#### `AWS_ACCESS_KEY_ID`
- **Description**: IAM user access key for Terraform and AWS operations
- **How to get**: Create IAM user with required policies (see docs/DEPLOYMENT.md)
- **Example**: `AKIAIOSFODNN7EXAMPLE`

#### `AWS_SECRET_ACCESS_KEY`
- **Description**: IAM user secret key
- **How to get**: Generated when creating IAM access keys
- **Example**: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`
- **⚠️ Keep this secret safe!**

---

### EC2 SSH Access

#### `EC2_SSH_KEY`
- **Description**: Private SSH key for EC2 instance access (entire PEM file content)
- **How to get**: 
  ```bash
  cat ~/.ssh/prompt-guessr-key.pem
  ```
- **Format**: Must include `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`
- **Example**:
  ```
  -----BEGIN RSA PRIVATE KEY-----
  MIIEowIBAAKCAQEA...
  ...
  -----END RSA PRIVATE KEY-----
  ```

#### `EC2_HOST`
- **Description**: Public IP address of EC2 instance
- **How to get**: From Terraform output after `terraform apply`
  ```bash
  cd terraform
  terraform output ec2_public_ip
  ```
- **Example**: `52.14.123.45`

---

### Terraform Variables

#### `TF_VAR_ssh_key_name`
- **Description**: Name of SSH key pair in AWS EC2
- **How to get**: Name you used when creating key pair in AWS
- **Example**: `prompt-guessr-key`

#### `TF_VAR_allowed_ssh_cidr`
- **Description**: Your public IP address in CIDR notation (for SSH access)
- **How to get**: 
  ```bash
  echo "$(curl -s ifconfig.me)/32"
  ```
- **Example**: `203.0.113.50/32`
- **⚠️ Update this if your IP changes!**

---

### Backend Environment Variables

#### `REDIS_URL`
- **Description**: ElastiCache Redis connection string
- **How to get**: From Terraform output
  ```bash
  cd terraform
  terraform output redis_endpoint
  # Format as: redis://<endpoint>:<port>
  ```
- **Example**: `redis://prompt-guessr-redis.abc123.0001.use1.cache.amazonaws.com:6379`

#### `CORS_ORIGIN`
- **Description**: Amplify frontend URL for CORS configuration
- **How to get**: From Terraform output or Amplify console
  ```bash
  cd terraform
  terraform output amplify_default_domain
  # Add https:// prefix
  ```
- **Example**: `https://main.d1a2b3c4d5e6f7.amplifyapp.com`

#### `S3_BUCKET_NAME`
- **Description**: S3 bucket name for image storage
- **How to get**: From Terraform output
  ```bash
  cd terraform
  terraform output s3_bucket_name
  ```
- **Example**: `prompt-guessr-images-a1b2c3d4`

#### `IMAGE_PROVIDER`
- **Description**: Which image generation provider to use
- **Options**: `mock`, `huggingface`, `openai`
- **Recommended**: `huggingface` (free tier available)
- **Example**: `huggingface`

#### `HUGGINGFACE_API_KEY`
- **Description**: HuggingFace API token for image generation
- **How to get**: https://huggingface.co/settings/tokens
- **Required scopes**: Read access to Inference API
- **Example**: `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### `OPENAI_API_KEY` (Optional)
- **Description**: OpenAI API key for DALL-E image generation (fallback or primary)
- **How to get**: https://platform.openai.com/api-keys
- **Example**: `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **⚠️ This is a paid service!**

---

## Verification Checklist

After adding all secrets, verify:

- [ ] AWS credentials are valid: `aws sts get-caller-identity`
- [ ] EC2 SSH key works: `ssh -i ~/.ssh/prompt-guessr-key.pem ec2-user@<EC2_HOST>`
- [ ] Redis endpoint is accessible from EC2
- [ ] S3 bucket exists: `aws s3 ls s3://<S3_BUCKET_NAME>`
- [ ] HuggingFace API key works: Test in their playground
- [ ] Amplify app exists in AWS console

---

## Security Best Practices

✅ **DO:**
- Rotate keys regularly (every 90 days)
- Use least-privilege IAM policies
- Restrict SSH CIDR to your specific IP
- Enable MFA on AWS account
- Monitor CloudWatch for unauthorized access

❌ **DON'T:**
- Commit secrets to git
- Share secrets in plain text (Slack, email)
- Use root AWS credentials
- Leave SSH open to 0.0.0.0/0
- Reuse keys across projects

---

## Troubleshooting

### "Invalid AWS credentials" error
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
- Check IAM user has required permissions
- Ensure no extra whitespace in secret values

### "Permission denied (publickey)" SSH error
- Verify `EC2_SSH_KEY` includes header/footer
- Check no extra newlines at start/end
- Ensure key pair name matches `TF_VAR_ssh_key_name`

### "Connection refused" to EC2
- Verify `EC2_HOST` is correct public IP
- Check security group allows SSH from GitHub Actions IPs
- Ensure EC2 instance is running

### "CORS error" in browser
- Verify `CORS_ORIGIN` matches exact Amplify URL (including https://)
- Check backend restarted after updating secret
- Inspect browser console for actual origin

---

## Environment-Specific Secrets

For staging/development environments, create separate secrets with prefixes:

- `STAGING_EC2_HOST`
- `STAGING_REDIS_URL`
- `DEV_HUGGINGFACE_API_KEY`

Update workflows to use appropriate secrets based on branch.

---

**Last Updated**: February 7, 2026
