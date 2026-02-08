# Deployment Checklist

Use this checklist when deploying Prompt Guessr to AWS for the first time.

## Prerequisites

- [ ] AWS Account created
- [ ] GitHub repository created
- [ ] Local Terraform installed (v1.0+)
- [ ] AWS CLI installed and configured
- [ ] Git installed

---

## Phase 1: Initial AWS Setup

### 1. Create IAM User for Terraform/GitHub Actions

- [ ] Create IAM user: `prompt-guessr-deploy`
- [ ] Attach policies:
  - [ ] `AmazonEC2FullAccess`
  - [ ] `AmazonElastiCacheFullAccess`
  - [ ] `AmazonS3FullAccess`
  - [ ] `AWSAmplifyFullAccess`
  - [ ] `IAMFullAccess`
  - [ ] `AmazonVPCFullAccess`
- [ ] Generate access keys
- [ ] Save `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

### 2. Create SSH Key Pair

- [ ] Option A: Create in AWS Console → EC2 → Key Pairs
- [ ] Option B: Create locally and import
  ```bash
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/prompt-guessr-key
  aws ec2 import-key-pair --key-name prompt-guessr-key \
    --public-key-material fileb://~/.ssh/prompt-guessr-key.pub
  ```
- [ ] Download `.pem` file and save securely
- [ ] Set correct permissions: `chmod 400 ~/.ssh/prompt-guessr-key.pem`

### 3. Create Terraform State Backend

```bash
# Create S3 bucket for state
BUCKET_NAME="prompt-guessr-terraform-state-$(date +%s)"
aws s3 mb s3://${BUCKET_NAME} --region us-east-1
aws s3api put-bucket-versioning \
  --bucket ${BUCKET_NAME} \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

- [ ] Update `terraform/main.tf` backend config with bucket name
- [ ] Note bucket name: `_______________________________`

---

## Phase 2: Configure Terraform

### 1. Create terraform.tfvars

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars
```

- [ ] Set `project_name` (default: `prompt-guessr`)
- [ ] Set `environment` (default: `production`)
- [ ] Set `aws_region` (default: `us-east-1`)
- [ ] Set `ssh_key_name` (from Step 2 above)
- [ ] Set `allowed_ssh_cidr` (your IP: `curl ifconfig.me`)
- [ ] Set `github_repository` (format: `owner/repo`)
- [ ] Set `github_token` (create at https://github.com/settings/tokens)
  - [ ] Required scopes: `repo`, `admin:repo_hook`

### 2. Initialize and Apply Terraform

```bash
cd terraform
terraform init
terraform plan  # Review changes
terraform apply # Type 'yes' to confirm
```

- [ ] Terraform apply completed successfully
- [ ] Save outputs:
  ```bash
  terraform output -json > ../docs/terraform-outputs.json
  ```

### 3. Note Important Values

- [ ] EC2 Public IP: `_______________________________`
- [ ] Redis Endpoint: `_______________________________`
- [ ] S3 Bucket Name: `_______________________________`
- [ ] Amplify Domain: `_______________________________`

---

## Phase 3: Configure GitHub Secrets

Go to: `GitHub Repo → Settings → Secrets and variables → Actions`

### AWS Credentials
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`

### EC2 Access
- [ ] `EC2_HOST` (EC2 public IP)
- [ ] `EC2_SSH_KEY` (entire PEM file content)

### Terraform Variables
- [ ] `TF_VAR_ssh_key_name`
- [ ] `TF_VAR_allowed_ssh_cidr` (your IP + `/32`)

### Backend Environment
- [ ] `REDIS_URL` (format: `redis://<endpoint>:6379`)
- [ ] `CORS_ORIGIN` (Amplify URL with `https://`)
- [ ] `S3_BUCKET_NAME`
- [ ] `IMAGE_PROVIDER` (use `huggingface`)
- [ ] `HUGGINGFACE_API_KEY`
- [ ] `OPENAI_API_KEY` (optional)

**See [docs/GITHUB_SECRETS.md](./GITHUB_SECRETS.md) for detailed instructions**

---

## Phase 4: Initial Backend Deployment

### 1. SSH to EC2

```bash
ssh -i ~/.ssh/prompt-guessr-key.pem ec2-user@<EC2_PUBLIC_IP>
```

- [ ] Successfully connected to EC2
- [ ] Verify Node.js installed: `node --version` (should be v24.x)
- [ ] Verify PM2 installed: `pm2 --version`

### 2. Clone and Setup Backend

```bash
git clone https://github.com/<your-username>/prompt-guessr.git
cd prompt-guessr/prompt-guessr-backend
npm ci --production
```

- [ ] Repository cloned
- [ ] Dependencies installed

### 3. Create .env File

```bash
cat > .env << EOF
NODE_ENV=production
PORT=3001
REDIS_URL=redis://<redis-endpoint>:6379
CORS_ORIGIN=https://<amplify-domain>
IMAGE_PROVIDER=huggingface
HUGGINGFACE_API_KEY=<your-key>
S3_BUCKET_NAME=<bucket-name>
AWS_REGION=us-east-1
EOF
```

- [ ] `.env` file created with correct values

### 4. Build and Start

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

- [ ] Build successful
- [ ] PM2 running: `pm2 status`
- [ ] Health check: `curl http://localhost:3001/health`
  - [ ] Response: `{"status":"ok","redis":"connected"}`

---

## Phase 5: Configure Amplify

### 1. Connect to GitHub

- [ ] Go to AWS Amplify Console
- [ ] Find `prompt-guessr-frontend` app
- [ ] Connect to GitHub (authorize if needed)
- [ ] Select `main` branch

### 2. Configure Build Settings

Build spec should auto-detect, but verify:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd prompt-guessr-ui
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
```

- [ ] Build settings configured

### 3. Add Environment Variables

In Amplify Console → Environment variables:

- [ ] `NEXT_PUBLIC_API_URL` = `http://<EC2_PUBLIC_IP>:3001`
- [ ] `NEXT_PUBLIC_SOCKET_URL` = `http://<EC2_PUBLIC_IP>:3001`

- [ ] Trigger deployment
- [ ] Wait for build to complete (5-10 minutes)
- [ ] Deployment successful

---

## Phase 6: Update CORS

After Amplify deployment completes:

### 1. Update Backend CORS

```bash
ssh -i ~/.ssh/prompt-guessr.pem ec2-user@<EC2_PUBLIC_IP>
cd prompt-guessr/prompt-guessr-backend
nano .env
# Update CORS_ORIGIN to Amplify URL
pm2 restart all
```

- [ ] CORS_ORIGIN updated to Amplify domain
- [ ] Backend restarted

### 2. Update GitHub Secret

- [ ] Update `CORS_ORIGIN` secret in GitHub with Amplify URL

---

## Phase 7: End-to-End Testing

### 1. Backend Health Check

```bash
curl http://<EC2_PUBLIC_IP>:3001/health
```

- [ ] Response: `{"status":"ok","redis":"connected"}`

### 2. Frontend Access

- [ ] Open Amplify URL in browser
- [ ] No console errors
- [ ] Socket.IO connected (check browser console)

### 3. Full Game Flow

- [ ] Create a room
- [ ] Copy room link, open in incognito/different browser
- [ ] Join room with second player
- [ ] Both players ready up
- [ ] Host starts game
- [ ] Both submit prompts
- [ ] Images generate successfully
- [ ] Both select images
- [ ] Both submit guesses
- [ ] Scoring works
- [ ] Leaderboard displays
- [ ] Round ends properly

---

## Phase 8: Monitoring Setup

### 1. CloudWatch Logs

- [ ] Go to CloudWatch → Logs
- [ ] Find log group: `/aws/ec2/prompt-guessr-backend`
- [ ] Verify logs appearing

### 2. PM2 Monitoring

```bash
ssh ec2-user@<EC2_PUBLIC_IP>
pm2 monit  # Real-time monitoring
pm2 logs   # View logs
```

- [ ] PM2 monitoring accessible

### 3. Set Up Billing Alert

- [ ] AWS Console → Billing → Budgets
- [ ] Create budget: $10/month
- [ ] Set email alert at 80% threshold

---

## Automated Deployments

After initial setup, deployments are automatic:

- [ ] Push to `main` → Backend deploys via GitHub Actions
- [ ] Push to `main` → Frontend deploys via Amplify
- [ ] Terraform changes → Create PR, review plan, merge with `[terraform apply]` in commit message

---

## Troubleshooting

If anything fails, see:
- [ ] [docs/DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [ ] [docs/GITHUB_SECRETS.md](./GITHUB_SECRETS.md) - Secrets configuration
- [ ] CloudWatch Logs for errors
- [ ] PM2 logs: `pm2 logs`
- [ ] GitHub Actions logs for CI/CD failures

---

## Rollback Plan

If deployment breaks production:

```bash
# Backend rollback
ssh ec2-user@<EC2_HOST>
cd prompt-guessr/prompt-guessr-backend
git log --oneline -5
git checkout <previous-commit>
npm ci --production
npm run build
pm2 restart all

# Frontend rollback
# AWS Amplify Console → Deployments → Redeploy previous version
```

---

## Success! 🎉

You now have:
- ✅ Fully automated CI/CD pipeline
- ✅ Production infrastructure on AWS
- ✅ Backend on EC2 with PM2
- ✅ Frontend on Amplify
- ✅ Redis state management
- ✅ S3 image storage
- ✅ CloudWatch monitoring

**Estimated Monthly Cost**: ~$4 (Elastic IP only, rest is free tier)

---

**Deployment Date**: `_______________`  
**Deployed By**: `_______________`  
**Frontend URL**: `_______________`  
**Backend URL**: `_______________`
