# Deployment Guide - Prompt Guessr on AWS

This guide covers deploying Prompt Guessr to AWS using Terraform and GitHub Actions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Required GitHub Secrets](#required-github-secrets)
- [Deployment Steps](#deployment-steps)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)
- [Monitoring](#monitoring)

## Prerequisites

### Required Accounts
- **GitHub Account** (free)
- **AWS Account** (free tier eligible)
- **HuggingFace Account** (free tier available)

### Required Tools (Local)
- Git
- Terraform >= 1.0
- AWS CLI (configured with credentials)
- SSH client

### AWS IAM User Setup

Create an IAM user for GitHub Actions with these policies:
- `AmazonEC2FullAccess`
- `AmazonElastiCacheFullAccess`
- `AmazonS3FullAccess`
- `AWSAmplifyFullAccess`
- `IAMFullAccess` (for creating roles)
- `AmazonVPCFullAccess`

Generate access keys and save securely for GitHub Secrets configuration.

## Architecture Overview

```
┌──────────────┐
│   GitHub     │  Push to main
│  Repository  │──────────────┐
└──────────────┘              │
                              ▼
                    ┌─────────────────┐
                    │ GitHub Actions  │
                    │    Workflows    │
                    └────┬────────┬───┘
                         │        │
                 Backend │        │ Frontend
                Deploy  │        │ Deploy
                         │        │
           ┌─────────────▼─┐  ┌──▼──────────────┐
           │   AWS EC2     │  │  AWS Amplify    │
           │  (Backend)    │  │  (Frontend)     │
           │               │  │                 │
           │  - Node.js    │  │  - Next.js      │
           │  - Express    │  │  - React        │
           │  - Socket.IO  │  │  - WebSocket    │
           │  - PM2        │  │    Client       │
           └───┬───────────┘  └─────────────────┘
               │
               │ Reads/Writes
               │
       ┌───────▼────────┐      ┌──────────────┐
       │ ElastiCache    │      │   AWS S3     │
       │    Redis       │      │             │
       │                │      │  - Generated │
       │  - Game State  │      │    Images    │
       │  - Sessions    │      │  - 30 day    │
       │  - Rooms       │      │    lifecycle │
       └────────────────┘      └──────────────┘
```

## Required GitHub Secrets

Navigate to: `Repository → Settings → Secrets and variables → Actions → New repository secret`

### AWS Credentials
- `AWS_ACCESS_KEY_ID` - IAM user access key
- `AWS_SECRET_ACCESS_KEY` - IAM user secret key

### EC2 SSH Access
- `EC2_SSH_KEY` - Private SSH key (entire PEM file content)
- `TF_VAR_ssh_key_name` - Name of SSH key pair in AWS (e.g., `prompt-guessr-key`)
- `TF_VAR_allowed_ssh_cidr` - Your IP in CIDR format (e.g., `203.0.113.50/32`)

### API Keys
- `HUGGINGFACE_API_KEY` - HuggingFace API token for image generation
- `OPENAI_API_KEY` - (Optional) OpenAI API key if using DALL-E

### Environment Configuration
- `TF_VAR_aws_region` - (Optional) AWS region, default: `us-east-1`
- `PRODUCTION_CORS_ORIGIN` - Frontend URL for CORS (set after Amplify deployment)

## Deployment Steps

### Phase 1: Initial Infrastructure Setup

#### 1.1 Create SSH Key Pair in AWS

```bash
# Option A: Create in AWS Console
# EC2 → Key Pairs → Create key pair
# Name: prompt-guessr-key
# Type: RSA, .pem format
# Download and save securely

# Option B: Create locally and import
ssh-keygen -t rsa -b 4096 -f ~/.ssh/prompt-guessr-key -C "prompt-guessr-deploy"
aws ec2 import-key-pair --key-name prompt-guessr-key --public-key-material fileb://~/.ssh/prompt-guessr-key.pub
```

Add private key content to GitHub Secret `EC2_SSH_KEY`.

#### 1.2 Create Terraform State Backend

Terraform needs an S3 bucket to store state:

```bash
# Create unique bucket name
BUCKET_NAME="prompt-guessr-terraform-state-$(date +%s)"

# Create S3 bucket
aws s3 mb s3://${BUCKET_NAME} --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket ${BUCKET_NAME} \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Update `terraform/main.tf` with your bucket name in the backend configuration.

#### 1.3 Initialize Terraform

```bash
cd terraform
terraform init
terraform plan  # Review changes
terraform apply # Type 'yes' to confirm
```

Save outputs:
```bash
terraform output -json > ../docs/terraform-outputs.json
```

You'll need these values:
- `ec2_public_ip` - Backend server address
- `redis_endpoint` - ElastiCache connection string
- `s3_bucket_name` - Image storage bucket
- `amplify_app_url` - Frontend URL (after Amplify setup)

### Phase 2: Configure GitHub Secrets

Add the following secrets with values from Terraform outputs:

- `EC2_HOST` = `<ec2_public_ip>`
- `REDIS_URL` = `redis://<redis_endpoint>:6379`
- `S3_BUCKET_NAME` = `<s3_bucket_name>`

### Phase 3: Initial Backend Deployment

SSH into EC2 instance for first-time setup:

```bash
ssh -i ~/.ssh/prompt-guessr-key ec2-user@<ec2_public_ip>
```

On EC2 instance:

```bash
# Clone repository
git clone https://github.com/<your-username>/prompt-guessr.git
cd prompt-guessr/prompt-guessr-backend

# Install dependencies
npm ci --production

# Create production environment file
cat > .env << EOF
PORT=3001
NODE_ENV=production
REDIS_URL=redis://<redis_endpoint>:6379
CORS_ORIGIN=https://<amplify-domain>
IMAGE_PROVIDER=huggingface
HUGGINGFACE_API_KEY=<your_key>
S3_BUCKET_NAME=<bucket_name>
AWS_REGION=us-east-1
EOF

# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start

# Verify
curl http://localhost:3001/health
# Should return: {"status":"ok","redis":"connected"}
```

### Phase 4: Configure Amplify

After Terraform creates the Amplify app, connect it to GitHub:

1. Go to AWS Amplify Console
2. Find `prompt-guessr-frontend` app
3. Connect to GitHub repository (authorize if needed)
4. Select `main` branch
5. Configure build settings (should auto-detect Next.js)
6. Add environment variables:
   - `NEXT_PUBLIC_API_URL` = `http://<ec2_public_ip>:3001`
   - `NEXT_PUBLIC_SOCKET_URL` = `http://<ec2_public_ip>:3001`
7. Deploy

### Phase 5: Update CORS Configuration

After Amplify deployment, update backend CORS:

```bash
# SSH to EC2
ssh -i ~/.ssh/prompt-guessr-key ec2-user@<ec2_public_ip>
cd prompt-guessr/prompt-guessr-backend

# Update .env
nano .env
# Change CORS_ORIGIN to: https://<amplify-domain>

# Restart
pm2 restart all
```

Also update GitHub Secret `PRODUCTION_CORS_ORIGIN` with Amplify URL.

### Phase 6: Verify Deployment

1. **Backend Health Check:**
   ```bash
   curl http://<ec2_public_ip>:3001/health
   ```

2. **Frontend Access:**
   - Open `https://<amplify-domain>` in browser
   - Check browser console for errors

3. **End-to-End Test:**
   - Create a room
   - Join with second browser/device
   - Play through all phases
   - Monitor CloudWatch Logs for errors

## Automated Deployments

After initial setup, changes are automatically deployed:

### Backend Deployment (GitHub Actions)

Triggers on push to `main` branch with changes in `prompt-guessr-backend/**`

Workflow:
1. Runs build and tests
2. SCPs built files to EC2
3. SSHs to EC2 and runs:
   ```bash
   cd prompt-guessr/prompt-guessr-backend
   git pull
   npm ci --production
   npm run build
   pm2 restart ecosystem.config.js
   ```

### Frontend Deployment (GitHub Actions)

Triggers on push to `main` branch with changes in `prompt-guessr-ui/**`

Amplify automatically detects changes and deploys (no manual action needed).

### Infrastructure Changes (Terraform)

Triggers on push to `main` branch with changes in `terraform/**`

Workflow:
1. Runs `terraform plan`
2. Posts plan as comment on commit
3. Manual approval required for `terraform apply` via workflow dispatch

## Rollback Procedures

### Backend Rollback

```bash
# SSH to EC2
ssh -i ~/.ssh/prompt-guessr-key ec2-user@<ec2_public_ip>
cd prompt-guessr/prompt-guessr-backend

# Find commit to rollback to
git log --oneline -10

# Checkout previous version
git checkout <commit-hash>

# Rebuild and restart
npm ci --production
npm run build
pm2 restart all

# Verify
curl http://localhost:3001/health
```

### Frontend Rollback

1. Go to AWS Amplify Console
2. Select `prompt-guessr-frontend` app
3. Click on deployment history
4. Find previous working deployment
5. Click "Redeploy this version"

### Infrastructure Rollback

```bash
cd terraform

# Revert terraform changes
git checkout <previous-commit> -- .

# Apply reverted state
terraform plan
terraform apply
```

## Troubleshooting

### Backend Not Responding

**Check if service is running:**
```bash
ssh ec2-user@<ec2_public_ip>
pm2 status
pm2 logs
```

**Check Redis connectivity:**
```bash
redis-cli -h <redis_endpoint> ping
# Should return: PONG
```

**Check security groups:**
- EC2 security group allows inbound on port 3001
- ElastiCache security group allows inbound from EC2

### Frontend Can't Connect to Backend

**Check CORS configuration:**
```bash
# Backend .env should have correct Amplify domain
grep CORS_ORIGIN /home/ec2-user/prompt-guessr/prompt-guessr-backend/.env
```

**Check environment variables in Amplify:**
- Amplify Console → Environment variables
- Verify `NEXT_PUBLIC_SOCKET_URL` points to EC2 IP

**Check browser console:**
- Look for Socket.IO connection errors
- Verify WebSocket upgrade succeeds

### Images Not Generating

**Check HuggingFace API key:**
```bash
# SSH to EC2
grep HUGGINGFACE_API_KEY /home/ec2-user/prompt-guessr/prompt-guessr-backend/.env
```

**Check CloudWatch Logs:**
- CloudWatch → Logs → `/aws/ec2/prompt-guessr-backend`
- Look for image generation errors

**Test API key locally:**
```bash
curl -X POST https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1 \
  -H "Authorization: Bearer <your_key>" \
  -H "Content-Type: application/json" \
  -d '{"inputs": "test prompt"}'
```

### Terraform State Issues

**State locked:**
```bash
# If deployment failed mid-apply
cd terraform
terraform force-unlock <lock-id>
```

**State drift:**
```bash
# Check what changed outside Terraform
terraform plan -detailed-exitcode
# Exit code 2 = drift detected
terraform refresh  # Update state to match reality
```

## Monitoring

### CloudWatch Logs

**Backend Logs:**
- Log Group: `/aws/ec2/prompt-guessr-backend`
- Retention: 7 days

**View logs:**
```bash
aws logs tail /aws/ec2/prompt-guessr-backend --follow
```

### CloudWatch Alarms

Terraform creates:
- `prompt-guessr-high-cpu` - EC2 CPU > 80% for 5 minutes
- SNS topic for email notifications

### PM2 Monitoring

```bash
ssh ec2-user@<ec2_public_ip>
pm2 monit  # Real-time dashboard
pm2 logs   # View logs
```

### Cost Monitoring

Set up AWS Budget Alert:
```bash
aws budgets create-budget \
  --account-id <your-account-id> \
  --budget file://budget-config.json
```

**budget-config.json:**
```json
{
  "BudgetName": "PromptGuessr-Monthly",
  "BudgetLimit": {
    "Amount": "10",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

## Cleanup / Destroy

To tear down all infrastructure:

```bash
cd terraform
terraform destroy  # Type 'yes' to confirm
```

Manual cleanup required:
- Delete S3 terraform state bucket
- Delete DynamoDB terraform-locks table
- Remove GitHub Secrets
- Delete SSH key from AWS

---

## Emergency Contacts

- **AWS Support:** https://console.aws.amazon.com/support/
- **GitHub Actions Status:** https://www.githubstatus.com/
- **HuggingFace Status:** https://status.huggingface.co/

## Additional Resources

- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Amplify Docs](https://docs.amplify.aws/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Last Updated:** February 7, 2026
