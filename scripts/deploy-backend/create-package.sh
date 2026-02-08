#!/bin/bash
# Create deployment package for backend

set -e

cd prompt-guessr-backend
tar -czf deploy.tar.gz \
  dist/ \
  package.json \
  package-lock.json \
  ecosystem.config.js \
  shared/

echo "✅ Deployment package created: prompt-guessr-backend/deploy.tar.gz"
