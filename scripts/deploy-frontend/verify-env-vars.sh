#!/bin/bash
# Verify environment variables are documented in .env.example

set -e

cd prompt-guessr-ui

if ! grep -q "NEXT_PUBLIC_API_URL" .env.example; then
  echo "❌ NEXT_PUBLIC_API_URL not documented in .env.example"
  exit 1
fi

if ! grep -q "NEXT_PUBLIC_SOCKET_URL" .env.example; then
  echo "❌ NEXT_PUBLIC_SOCKET_URL not documented in .env.example"
  exit 1
fi

echo "✅ Environment variables documented"
