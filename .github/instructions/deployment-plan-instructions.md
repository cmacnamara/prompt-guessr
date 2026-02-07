Plan: Deploy Prompt Guessr to AWS with Terraform & GitHub Actions

TL;DR: We'll set up GitHub repo with monorepo structure, create Terraform modules for AWS infrastructure (EC2 backend, ElastiCache Redis, S3 images, Amplify frontend), and automate deployment via GitHub Actions. The backend will run on EC2 with PM2 process management, frontend on Amplify, using GitHub Secrets for API keys. Total estimated cost: ~$4/month for public IPv4 (everything else free tier).

Key Decision: Starting with production-only environment, AWS default URLs, and GitHub Secrets for simplicity and speed.

Steps
Phase 1: GitHub Repository Setup
Initialize Git repository and create GitHub repo

Run git init in /Users/christopher.macnamara/workspace/sandbox/prompt-guessr if not already initialized
Create .gitignore for Node.js, covering node_modules/, dist/, .next/, .env, *.log
Create GitHub repository (public or private based on preference)
Push initial code with meaningful commit: "Initial commit - working local version"
Add root-level README.md

Document monorepo structure (prompt-guessr-backend/ and prompt-guessr-ui/)
Include local development setup instructions
Add architecture diagram showing AWS services
Link to deployment workflow documentation
Create deployment documentation structure

Create docs/ folder with DEPLOYMENT.md for AWS setup steps
Document required GitHub Secrets (will be referenced by Actions)
Include rollback procedures
Add troubleshooting guide
Phase 2: Pre-Deployment Code Fixes
Fix hardcoded CORS in backend

Update backend/src/index.ts to use CORS_ORIGIN environment variable for both Socket.IO and Express
Remove hardcoded http://localhost:3000 fallback for production builds
Add validation that CORS_ORIGIN is set in production mode
Add production-ready Next.js configuration

Update frontend/next.config.js with:
output: 'standalone' for optimized builds
Restrict images.remotePatterns to specific AI provider domains
Add production environment variable validation
Create public/.well-known/ directory for SSL certificates (if needed later)
Create PM2 ecosystem file for backend

Create backend/ecosystem.config.js with:
Single instance configuration (free tier EC2 is single-core)
Environment variable loading
Log file rotation settings
Graceful shutdown handling
Auto-restart on failure
Add health check improvements

Enhance backend/src/index.ts health endpoint to check Redis connectivity
Return 503 status if Redis is disconnected
Add /ready endpoint for deployment health checks (returns 200 only when fully initialized)
Phase 3: Terraform Infrastructure Setup
Create Terraform project structure

Create terraform/ directory at repository root
Create subdirectories: modules/vpc/, modules/ec2/, modules/elasticache/, modules/s3/, modules/amplify/
Create root main.tf, variables.tf, outputs.tf, and terraform.tfvars.example
Add terraform/.gitignore to exclude .terraform/, *.tfstate, *.tfvars (except example)
Create VPC module (terraform/modules/vpc/)

Define VPC with two public subnets (for EC2) across 2 availability zones
Create one private subnet (for ElastiCache)
Configure Internet Gateway for public subnets
Set up route tables and subnet associations
Export VPC ID, subnet IDs, and CIDR blocks as outputs
Create Security Groups module (terraform/modules/security/)

EC2 Security Group: Allow inbound HTTP (80), HTTPS (443), Socket.IO port (3001), SSH (22 from your IP only)
ElastiCache Security Group: Allow Redis port (6379) ONLY from EC2 security group
Use aws_security_group and aws_security_group_rule resources
Export security group IDs as outputs
Create EC2 module (terraform/modules/ec2/)

Launch t3.micro instance with Amazon Linux 2023 AMI (free tier eligible)
Attach security group from step 10
Create and attach Elastic IP (for static public IP - this is the ~$4/month cost)
User data script to install: Node.js 20, PM2, Git, CloudWatch agent
Create IAM role with CloudWatch Logs permissions
Tag with Name=prompt-guessr-backend, Environment=production
Export public IP, instance ID, and SSH key name
Create ElastiCache module (terraform/modules/elasticache/)

Launch cache.t3.micro single-node Redis cluster (free tier eligible)
Place in private subnet from VPC module
Attach ElastiCache security group
Set parameter group for Redis 7.x
Enable automatic backups (free within limits)
Export Redis endpoint URL
Create S3 module (terraform/modules/s3/)

Create S3 bucket with unique name prompt-guessr-images-{random-suffix}
Enable versioning (for accidental deletion protection)
Configure CORS to allow frontend domain access
Set lifecycle policy to delete images older than 30 days (keep costs down)
Block public access but allow GetObject with signed URLs
Create IAM policy for EC2 instance to PutObject/GetObject
Export bucket name and ARN
Create Amplify module (terraform/modules/amplify/)

Create AWS Amplify app connected to GitHub repository
Configure build settings for Next.js (amplify.yml)
Set environment variables: NEXT_PUBLIC_API_URL (EC2 IP), NEXT_PUBLIC_SOCKET_URL (EC2 IP:3001)
Configure branch auto-deployment for main branch
Set custom build timeout (Next.js can take time)
Export Amplify app URL
Wire modules together in root main.tf

Call VPC module first (dependency for others)
Call Security Groups module (depends on VPC)
Call EC2, ElastiCache, S3, Amplify modules in parallel (all depend on VPC/security)
Configure remote state backend using S3 + DynamoDB for state locking (separate bucket)
Add required providers: AWS provider with region variable
Create Terraform variables and outputs

In variables.tf: AWS region (default us-east-1), SSH key name, allowed SSH IP CIDR, environment tags
In outputs.tf: EC2 public IP, Redis endpoint, S3 bucket name, Amplify URL
Create terraform.tfvars.example with placeholder values
Phase 4: GitHub Actions CI/CD Pipeline
Create backend deployment workflow (.github/workflows/deploy-backend.yml)

Trigger on push to main branch (paths: prompt-guessr-backend/**, .github/workflows/deploy-backend.yml)
Jobs:
Build & Test: Install dependencies, run TypeScript build, run tests (if exist)
Deploy to EC2:
Use SCP action to copy dist/, package.json, package-lock.json to EC2
Use SSH action to run: npm ci --production, pm2 restart ecosystem.config.js
Secrets required: EC2_SSH_KEY, EC2_HOST (from Terraform outputs), EC2_USER (ec2-user)
Environment variables passed: REDIS_URL, CORS_ORIGIN, IMAGE_PROVIDER, HUGGINGFACE_API_KEY (from GitHub Secrets)
Create frontend deployment workflow (.github/workflows/deploy-frontend.yml)

Trigger on push to main branch (paths: prompt-guessr-ui/**, .github/workflows/deploy-frontend.yml)
Jobs:
Build Check: Install dependencies, run next build to verify build succeeds
Notify Amplify: Amplify auto-deploys from GitHub, but we can trigger webhook for faster builds
Environment variables injected via Amplify settings (set in Terraform)
Secrets required: None (Amplify pulls code directly from GitHub)
Create infrastructure workflow (.github/workflows/terraform.yml)

Trigger on:
Push to main (paths: terraform/**)
Manual workflow dispatch with apply or plan input
Jobs:
Terraform Plan: Run terraform plan on every push, post plan as PR comment
Terraform Apply: Only on manual dispatch or specific commit message pattern [terraform apply]
Use hashicorp/setup-terraform action
Store Terraform state in S3 backend (separate infrastructure bucket - set up manually first)
Secrets required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, TF_VAR_ssh_key_name
Create shared types sync workflow (.github/workflows/sync-types.yml)

Trigger on changes to prompt-guessr-backend/shared/** or prompt-guessr-ui/shared/**
Job: Verify both directories have identical files, fail if drift detected
Alternative: Create symlink or npm workspace to avoid duplication
Prevents deployment with mismatched types
Phase 5: Secrets and Environment Configuration
Configure GitHub Secrets

Navigate to repo Settings → Secrets and variables → Actions
Add secrets:
AWS_ACCESS_KEY_ID (IAM user for Terraform/GitHub Actions)
AWS_SECRET_ACCESS_KEY
EC2_SSH_KEY (private key for SSH access, generated during EC2 setup)
HUGGINGFACE_API_KEY or OPENAI_API_KEY (for image generation)
TF_VAR_ssh_key_name (name of SSH key in AWS)
TF_VAR_allowed_ssh_cidr (your current IP for SSH access)
Create environment-specific config files

Backend: Create backend/.env.production.example with production placeholders
Frontend: Create frontend/.env.production (committed, public vars only)
Document in docs/DEPLOYMENT.md which secrets are required and where to set them
Set up AWS IAM user for CI/CD

Create IAM user github-actions-prompt-guessr
Attach policies: AmazonEC2FullAccess, AmazonElastiCacheFullAccess, AmazonS3FullAccess, AWSAmplifyFullAccess
Generate access keys and store in GitHub Secrets
Enable MFA for security (optional but recommended)
Phase 6: Initial Deployment
Bootstrap Terraform state backend

Manually create S3 bucket prompt-guessr-terraform-state-{random} in AWS console
Create DynamoDB table terraform-locks with LockID primary key (string)
Update terraform/main.tf backend configuration with bucket name
Run terraform init locally to initialize state
Execute Terraform infrastructure provisioning

Run terraform plan locally to review changes
Run terraform apply to create all AWS resources
Save outputs (EC2 IP, Redis endpoint, S3 bucket, Amplify URL) to secure notes
SSH into EC2 instance to verify Node.js and PM2 installed correctly
Initial backend deployment

Manually SSH to EC2 instance (first time only)
Clone GitHub repository: git clone <repo-url>
Navigate to prompt-guessr-backend
Create .env file with production values (Redis endpoint from Terraform, API keys from GitHub Secrets)
Run npm ci and npm run build
Start with PM2: pm2 start ecosystem.config.js
Verify with: curl http://localhost:3001/health
Connect Amplify to GitHub

In AWS Amplify console, verify app is connected to correct repository and branch
Trigger first deployment manually
Monitor build logs for errors
Verify NEXT_PUBLIC_SOCKET_URL points to EC2 public IP
Test deployed frontend URL
End-to-end verification

Open Amplify frontend URL in browser
Create a room to verify API connection (EC2 backend)
Join room to verify Socket.IO WebSocket connection
Submit prompt to verify Redis connection
Generate images to verify S3 and image provider integration
Check all phases work: lobby → prompts → images → guessing → results
Phase 7: Post-Deployment Configuration
Set up CloudWatch monitoring

Configure EC2 CloudWatch agent to send logs to CloudWatch Logs (free tier: 5GB/month)
Create log groups: /aws/ec2/prompt-guessr-backend
Set log retention to 7 days (keeps costs down)
Create basic alarm for EC2 CPU > 80% for 5 minutes (email via SNS)
Document rollback procedures

Update docs/DEPLOYMENT.md with:
How to roll back backend: SSH + git checkout <commit> + rebuild + pm2 restart
How to roll back frontend: Amplify console → redeploy previous version
How to access logs: CloudWatch Logs group links
Emergency contacts and playbook
Create deployment checklist

Add .github/PULL_REQUEST_TEMPLATE.md with deployment checklist:
 Tests pass locally
 Environment variables documented if added
 Database migrations applied (if applicable)
 Shared types synced between backend and frontend
 Breaking changes communicated
Reference in docs/DEPLOYMENT.md
Verification
After completing all steps, verify the deployment:

Infrastructure verification:

Backend health check:

Redis connectivity:

Frontend access:

Open Amplify URL in browser
Check browser console for Socket.IO connection (should show "connected")
Full game flow:

Create room → ready up → start game → submit prompts → images generate → select image → guess → see results
Monitor CloudWatch Logs during game for errors
GitHub Actions:

Make a trivial change to backend/frontend
Push to main branch
Verify workflow runs successfully
Check deployed change appears in production
Decisions
Terraform over ClickOps: Infrastructure as code ensures reproducibility, version control, and prevents configuration drift. Manual AWS console clicks are hard to replicate and document.

GitHub Actions over other CI/CD: Already using GitHub for code; keeps everything in one platform. Free tier is generous (2,000 minutes/month). Alternative (CircleCI, GitLab CI) would add complexity.

PM2 over systemd: PM2 provides easier log management, graceful reload, and Node.js-specific features. Systemd would work but requires more manual setup.

Amplify over custom S3+CloudFront: Amplify handles Next.js server-side rendering automatically, manages build invalidations, and integrates with GitHub. Manual S3 setup wouldn't support SSR.

Elastic IP over dynamic IP: Game server needs stable endpoint for WebSocket connections. ~$4/month is unavoidable for persistent public IPv4. IPv6-only would break compatibility with many users.

Single production environment first: Reduces complexity and cost. Staging can be added later by duplicating Terraform modules with different variable files.

GitHub Secrets over AWS Secrets Manager: Simpler integration with GitHub Actions, zero cost. Can migrate to Secrets Manager later if needed for rotation or cross-service access.

Claude Sonnet 4.5 • 1x
