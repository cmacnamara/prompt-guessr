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
- **Description**: Amplify frontend URL(s) for CORS configuration (comma-separated for multiple)
- **How to get**: From Terraform output or Amplify console
  ```bash
  cd terraform
  terraform output amplify_default_domain
  # Add https:// prefix
  ```
- **Example (single origin)**: `https://main.d1a2b3c4d5e6f7.amplifyapp.com`
- **Example (multiple origins)**: `https://main.d1a2b3c4d5e6f7.amplifyapp.com,https://prompt-guessr.com`
- **⚠️ Note**: Use comma separation (no spaces) for multiple domains
- **For your deployment**: `https://main.d2sk5w35cetf0e.amplifyapp.com`

#### `S3_BUCKET_NAME`
- **Description**: S3 bucket name for image storage
- **How to get**: From Terraform output
  ```bash
  cd terraform
  terraform output s3_bucket_name
  ```
- **Example**: `prompt-guessr-images-prod-abc123`

---

### Terraform Variables (for GitHub Actions)

These secrets are used by the Terraform workflow to provision infrastructure.

#### `TF_VAR_ssh_key_name`
- **Description**: Name of SSH key pair in AWS EC2
- **How to get**: The name you used when creating the key pair
- **Example**: `prompt-guessr-key`

#### `TF_VAR_allowed_ssh_cidr`
- **Description**: Your public IP in CIDR notation for SSH access
- **How to get**: 
  ```bash
  echo "$(curl -s ifconfig.me)/32"
  ```
- **Example**: `203.0.113.50/32`
- **⚠️ Update if your IP changes**

#### `TF_VAR_github_token`
- **Description**: GitHub personal access token for Amplify
- **How to get**: https://github.com/settings/tokens
- **Required scopes**: `repo`, `admin:repo_hook`
- **Example**: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### `TF_VAR_api_domain_name`
- **Description**: Custom domain for backend API (enables HTTPS)
- **Example**: `api.prompt-guessr.com`
- **⚠️ Optional but required for HTTPS** - Leave empty to use HTTP-only ALB

#### `TF_VAR_frontend_domain_name`
- **Description**: Custom domain for frontend (optional)
- **Example**: `prompt-guessr.com` or `www.prompt-guessr.com`
- **⚠️ Optional** - Leave empty to use Amplify's default domain

---

## How Secrets Work

### Local Development
- Create `terraform/terraform.tfvars` file with your values
- This file is in `.gitignore` and never committed
- Terraform reads variables from this file

### GitHub Actions (CI/CD)
- Variables are stored as GitHub Secrets
- Passed to Terraform as environment variables with `TF_VAR_` prefix
- Example: `TF_VAR_api_domain_name` → Terraform variable `api_domain_name`

### Adding/Updating Secrets

1. Navigate to repository on GitHub.com
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** (or edit existing)
4. Name must match exactly (case-sensitive)
5. Paste the value
6. Click **Add secret**

**Example:**
```
Name: TF_VAR_api_domain_name
Value: api.prompt-guessr.com
```

---

## Complete Secret Checklist

Use this checklist to ensure all secrets are configured:

### AWS & Infrastructure
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `TF_VAR_ssh_key_name`
- [ ] `TF_VAR_allowed_ssh_cidr`

### GitHub Integration
- [ ] `TF_VAR_github_token`

### Backend Deployment
- [ ] `EC2_SSH_KEY`
- [ ] `EC2_HOST` (set after first Terraform apply)
- [ ] `REDIS_URL` (set after first Terraform apply)
- [ ] `S3_BUCKET_NAME` (set after first Terraform apply)

### Backend Environment
- [ ] `CORS_ORIGIN` (Amplify URL)
- [ ] `IMAGE_PROVIDER` (e.g., `mock`, `huggingface`, `openai`)
- [ ] `HUGGINGFACE_API_KEY`
- [ ] `OPENAI_API_KEY` (optional)

### Custom Domains (Optional for HTTPS)
- [ ] `TF_VAR_api_domain_name` (e.g., `api.prompt-guessr.com`)
- [ ] `TF_VAR_frontend_domain_name` (optional, e.g., `prompt-guessr.com`)

---

## Security Best Practices

1. **Never commit secrets to Git**
   - Always use `.gitignore` for `*.tfvars` files
   - Never hardcode secrets in code
   
2. **Rotate secrets regularly**
   - Especially AWS access keys
   - GitHub tokens
   - API keys

3. **Use least privilege**
   - IAM users should have minimal required permissions
   - Don't use root AWS credentials

4. **Monitor usage**
   - Check AWS CloudTrail for suspicious activity
   - Review GitHub Actions logs periodically

5. **Delete unused secrets**
   - Remove secrets for destroyed infrastructure
   - Clean up test/dev secrets
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
