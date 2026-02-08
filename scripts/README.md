# Deployment Scripts

This directory contains reusable shell scripts extracted from GitHub Actions workflows. These scripts can be run locally for testing or used in CI/CD pipelines.

## Directory Structure

```
scripts/
├── deploy-backend/       # Backend deployment scripts
├── deploy-frontend/      # Frontend deployment scripts
└── sync-types/          # Type synchronization scripts
```

## Backend Deployment Scripts

### `deploy-backend/create-package.sh`
Creates a deployment tarball containing the backend application.

**Usage:**
```bash
./scripts/deploy-backend/create-package.sh
```

**Output:** `prompt-guessr-backend/deploy.tar.gz`

---

### `deploy-backend/configure-ssh.sh`
Configures SSH for EC2 deployment by setting up SSH keys and known hosts.

**Usage:**
```bash
./scripts/deploy-backend/configure-ssh.sh <EC2_HOST> <EC2_SSH_KEY>
```

**Arguments:**
- `EC2_HOST` - EC2 instance hostname or IP
- `EC2_SSH_KEY` - Private SSH key content

**Example:**
```bash
./scripts/deploy-backend/configure-ssh.sh "ec2-1-2-3-4.compute-1.amazonaws.com" "$EC2_SSH_KEY"
```

---

### `deploy-backend/copy-to-ec2.sh`
Copies the deployment package to the EC2 instance.

**Usage:**
```bash
./scripts/deploy-backend/copy-to-ec2.sh <EC2_HOST>
```

**Prerequisites:**
- SSH must be configured (run `configure-ssh.sh` first)
- Deployment package must exist (`create-package.sh` must have run)

**Example:**
```bash
./scripts/deploy-backend/copy-to-ec2.sh "ec2-1-2-3-4.compute-1.amazonaws.com"
```

---

### `deploy-backend/deploy-on-ec2.sh`
Remote deployment script that runs on the EC2 instance to extract, configure, and start the application.

**Usage:**
This script is executed remotely via SSH. Environment variables must be passed:

```bash
ssh -i ~/.ssh/id_rsa ec2-user@<EC2_HOST> \
  "REDIS_URL=... \
   CORS_ORIGIN=... \
   IMAGE_PROVIDER=... \
   HUGGINGFACE_API_KEY=... \
   OPENAI_API_KEY=... \
   S3_BUCKET_NAME=... \
   bash -s" < ./scripts/deploy-backend/deploy-on-ec2.sh
```

**Environment Variables:**
- `REDIS_URL` - Redis connection URL
- `CORS_ORIGIN` - CORS allowed origin
- `IMAGE_PROVIDER` - Image generation provider (mock/huggingface/openai)
- `HUGGINGFACE_API_KEY` - HuggingFace API key
- `OPENAI_API_KEY` - OpenAI API key
- `S3_BUCKET_NAME` - S3 bucket for image storage

---

### `deploy-backend/health-check.sh`
Performs health checks on the deployed backend with retries.

**Usage:**
```bash
./scripts/deploy-backend/health-check.sh <EC2_HOST>
```

**Behavior:**
- Retries up to 12 times (60 seconds total)
- Uses 5-second intervals between attempts
- Exits with code 0 on success, 1 on failure

**Example:**
```bash
./scripts/deploy-backend/health-check.sh "ec2-1-2-3-4.compute-1.amazonaws.com"
```

---

### `deploy-backend/cleanup.sh`
Cleans up temporary files and SSH keys after deployment.

**Usage:**
```bash
./scripts/deploy-backend/cleanup.sh
```

---

## Frontend Deployment Scripts

### `deploy-frontend/verify-env-vars.sh`
Verifies that required environment variables are documented in `.env.example`.

**Usage:**
```bash
./scripts/deploy-frontend/verify-env-vars.sh
```

**Checks:**
- `NEXT_PUBLIC_API_URL` exists in `.env.example`
- `NEXT_PUBLIC_SOCKET_URL` exists in `.env.example`

---

## Type Synchronization Scripts

### `sync-types/compare-types.sh`
Compares shared TypeScript types between backend and frontend to ensure they're in sync.

**Usage:**
```bash
./scripts/sync-types/compare-types.sh
```

**Behavior:**
- Compares `prompt-guessr-backend/shared/` with `prompt-guessr-ui/shared/`
- Checks file lists match
- Compares file contents with diff
- Exits with code 1 if differences found

**Output:**
- Lists each file as synced ✅ or different ❌
- Shows diff output for mismatched files
- Provides instructions to fix sync issues

---

## Local Testing

All scripts support local execution for testing before deployment:

### Test Backend Deployment Locally

```bash
# 1. Build the backend first
cd prompt-guessr-backend
npm run build
cd ..

# 2. Create deployment package
./scripts/deploy-backend/create-package.sh

# 3. Test SSH configuration (with test credentials)
./scripts/deploy-backend/configure-ssh.sh "test-host.com" "$TEST_SSH_KEY"

# 4. Cleanup
./scripts/deploy-backend/cleanup.sh
```

### Test Type Sync

```bash
./scripts/sync-types/compare-types.sh
```

### Test Frontend Env Vars

```bash
./scripts/deploy-frontend/verify-env-vars.sh
```

---

## CI/CD Integration

These scripts are used by GitHub Actions workflows:

- **`.github/workflows/deploy-backend.yml`** - Uses all `deploy-backend/` scripts
- **`.github/workflows/deploy-frontend.yml`** - Uses `deploy-frontend/verify-env-vars.sh`
- **`.github/workflows/sync-types.yml`** - Uses `sync-types/compare-types.sh`

---

## Best Practices

1. **Always test locally** before committing changes to scripts
2. **Keep scripts idempotent** - safe to run multiple times
3. **Use set -e** at the start of each script to fail fast on errors
4. **Quote variables** to handle spaces in arguments
5. **Add helpful error messages** with context
6. **Check prerequisites** before executing critical operations

---

## Troubleshooting

### Permission Denied
If you get permission errors, ensure scripts are executable:
```bash
chmod +x scripts/**/*.sh
```

### SSH Connection Failed
Check:
1. EC2 instance is running
2. Security group allows port 22
3. SSH key is correct
4. Host is reachable via `ping` or `telnet`

### Health Check Failed
Check:
1. Application logs: `ssh ec2-user@<host> 'pm2 logs'`
2. PM2 status: `ssh ec2-user@<host> 'pm2 status'`
3. Redis connection
4. Security group allows port 3001

### Type Sync Failed
Fix by copying the correct version:
```bash
# If backend is correct
cp -r prompt-guessr-backend/shared/* prompt-guessr-ui/shared/

# If frontend is correct
cp -r prompt-guessr-ui/shared/* prompt-guessr-backend/shared/
```

---

## Contributing

When adding new scripts:

1. Create script in appropriate subdirectory
2. Make it executable: `chmod +x script.sh`
3. Add documentation to this README
4. Test locally before committing
5. Update GitHub Actions workflows to use the script
6. Add usage examples
