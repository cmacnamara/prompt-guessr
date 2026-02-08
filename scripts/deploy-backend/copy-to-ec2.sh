#!/bin/bash
# Copy deployment package to EC2

set -e

EC2_HOST="${1:?EC2_HOST is required}"

echo "Copying deployment package to EC2..."

scp -i ~/.ssh/id_rsa \
  prompt-guessr-backend/deploy.tar.gz \
  ec2-user@"$EC2_HOST":/tmp/deploy.tar.gz

echo "✅ Files copied to EC2"
