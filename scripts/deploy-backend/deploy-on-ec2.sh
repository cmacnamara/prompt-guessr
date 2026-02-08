#!/bin/bash
# Remote deployment script - runs on EC2 instance

set -e

# Create app directory structure if it doesn't exist
mkdir -p ~/prompt-guessr/prompt-guessr-backend

# Navigate to app directory
cd ~/prompt-guessr/prompt-guessr-backend

# Extract deployment package
tar -xzf /tmp/deploy.tar.gz
rm /tmp/deploy.tar.gz

# Install production dependencies
echo "Installing dependencies..."
npm ci --production

# Create logs directory
mkdir -p logs

# Update environment variables
echo "Updating environment variables..."
cat > .env << ENVEOF
NODE_ENV=production
PORT=3001
REDIS_URL=${REDIS_URL}
CORS_ORIGIN=${CORS_ORIGIN}
IMAGE_PROVIDER=${IMAGE_PROVIDER}
HUGGINGFACE_API_KEY=${HUGGINGFACE_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
S3_BUCKET_NAME=${S3_BUCKET_NAME}
AWS_REGION=us-east-1
ENVEOF

# Restart with PM2
echo "Restarting application with PM2..."
pm2 restart ecosystem.config.js --update-env || pm2 start ecosystem.config.js
pm2 save

# Wait a moment for PM2 to start the process
sleep 2

# Check PM2 status
echo "PM2 status:"
pm2 status

# Show recent logs
echo "Recent application logs:"
pm2 logs --lines 20 --nostream || true

echo "✅ Deployment complete!"
