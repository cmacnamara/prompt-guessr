#!/bin/bash
# Configure SSH for EC2 deployment

set -e

EC2_HOST="${1:?EC2_HOST is required}"
EC2_SSH_KEY="${2:?EC2_SSH_KEY is required}"

mkdir -p ~/.ssh
echo "$EC2_SSH_KEY" > ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa

# Test EC2 host is reachable
echo "Testing connection to EC2 host: $EC2_HOST"

# Add host key to known_hosts
ssh-keyscan -H "$EC2_HOST" >> ~/.ssh/known_hosts || {
  echo "ERROR: Failed to scan SSH keys from EC2 host"
  echo "This usually means:"
  echo "  1. EC2 instance is not running"
  echo "  2. Security group is blocking port 22"
  echo "  3. EC2_HOST secret is incorrect"
  exit 1
}

echo "✅ SSH configured successfully"
