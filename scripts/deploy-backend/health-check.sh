#!/bin/bash
# Health check for backend deployment

set -e

EC2_HOST="${1:?EC2_HOST is required}"

echo "Waiting for backend to be ready..."

# Retry health check for up to 60 seconds
MAX_RETRIES=12
RETRY_INTERVAL=5
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_RETRIES ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "Health check attempt $ATTEMPT/$MAX_RETRIES..."
  
  if curl -f -s "http://$EC2_HOST:3001/health"; then
    echo ""
    echo "✅ Health check passed!"
    exit 0
  fi
  
  if [ $ATTEMPT -lt $MAX_RETRIES ]; then
    echo "Backend not ready yet, waiting ${RETRY_INTERVAL}s before retry..."
    sleep $RETRY_INTERVAL
  fi
done

echo "❌ Health check failed after $MAX_RETRIES attempts"
echo "Attempting to get PM2 logs for debugging..."
ssh -i ~/.ssh/id_rsa ec2-user@"$EC2_HOST" 'pm2 logs --lines 50 --nostream' || true
exit 1
