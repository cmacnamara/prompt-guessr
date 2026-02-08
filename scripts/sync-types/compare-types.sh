#!/bin/bash
# Compare shared types between backend and frontend

set -e

echo "Comparing shared types between backend and frontend..."

# Get list of files in each directory
BACKEND_FILES=$(cd prompt-guessr-backend/shared && find . -type f | sort)
FRONTEND_FILES=$(cd prompt-guessr-ui/shared && find . -type f | sort)

# Check if file lists match
if [ "$BACKEND_FILES" != "$FRONTEND_FILES" ]; then
  echo "❌ ERROR: File lists don't match!"
  echo ""
  echo "Backend files:"
  echo "$BACKEND_FILES"
  echo ""
  echo "Frontend files:"
  echo "$FRONTEND_FILES"
  exit 1
fi

echo "✅ File lists match"
echo ""

# Compare content of each file
DIFF_FOUND=0
for file in $BACKEND_FILES; do
  if ! diff -q "prompt-guessr-backend/shared/$file" "prompt-guessr-ui/shared/$file" > /dev/null; then
    echo "❌ DIFF FOUND: $file"
    echo "Differences:"
    diff "prompt-guessr-backend/shared/$file" "prompt-guessr-ui/shared/$file" || true
    echo ""
    DIFF_FOUND=1
  else
    echo "✅ $file is synced"
  fi
done

if [ $DIFF_FOUND -eq 1 ]; then
  echo ""
  echo "❌ ERROR: Shared types are not synced between backend and frontend!"
  echo ""
  echo "To fix:"
  echo "1. Decide which version is correct (backend or frontend)"
  echo "2. Copy from correct version to the other:"
  echo "   cp -r prompt-guessr-backend/shared/* prompt-guessr-ui/shared/"
  echo "   OR"
  echo "   cp -r prompt-guessr-ui/shared/* prompt-guessr-backend/shared/"
  echo "3. Commit and push the synced files"
  exit 1
fi

echo ""
echo "✅ All shared types are synced!"
