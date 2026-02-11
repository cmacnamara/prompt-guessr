# Socket.IO Troubleshooting Guide

## Issue Summary
Socket.IO connections failing on EC2/ALB deployment while HTTP/REST endpoints work fine.

## Root Causes Fixed

### 1. ✅ PM2 Ready Signal (CRITICAL)
**Problem**: PM2 config has `wait_ready: true` but backend never sent `process.send('ready')` signal.

**Impact**: PM2 might restart the process or not consider it fully initialized.

**Fix Applied**: Added `process.send('ready')` in server startup callback.

### 2. ✅ Socket.IO Transport Configuration
**Problem**: Default Socket.IO config might not handle ALB proxy properly.

**Fixes Applied**:
- Explicitly set transports: `['websocket', 'polling']`
- Increased timeouts for ALB environment
- Added upgrade support
- Better connection logging

## Deployment Steps

### Step 1: Build the Updated Backend
```bash
cd prompt-guessr-backend
npm run build
```

### Step 2: Deploy to EC2
Use your existing deployment script or:
```bash
# From project root
./scripts/deploy-backend/deploy.sh
```

### Step 3: Verify PM2 Status
SSH into EC2 and check:
```bash
ssh ec2-user@<your-ec2-ip>
pm2 status
pm2 logs --lines 50
```

**Look for**:
- ✅ "📡 Sent ready signal to PM2" in logs
- ✅ Status should be "online" not "launching"
- ✅ Restarts count should stop increasing

### Step 4: Test Socket.IO Connection

#### Test Direct Connection (Port 3001)
```bash
# From EC2
curl http://localhost:3001/socket.io/
# Should return: {"code":0,"message":"Transport unknown"}

# From your local machine (if security group allows)
curl http://<ec2-public-ip>:3001/socket.io/
```

#### Test Through ALB
```bash
# HTTP
curl http://<alb-dns-name>/socket.io/

# HTTPS (if configured)
curl https://<your-domain>/socket.io/
```

### Step 5: Check Browser Console
1. Open deployed frontend
2. Open browser DevTools → Console
3. Look for Socket.IO connection logs:
   - ✅ "✅ Socket connected: <id> Transport: websocket"
   - ❌ "❌ Socket connection error: ..."

### Step 6: Check Backend Logs
```bash
# On EC2
pm2 logs prompt-guessr-backend --lines 100

# Look for:
# - "Socket connected: <id> from <ip> via websocket"
# - "Socket upgraded to websocket"
# - Connection errors
```

## Common Issues & Solutions

### Issue: PM2 Shows "launching" Instead of "online"
**Cause**: App not sending ready signal to PM2

**Check**:
```bash
pm2 logs | grep "ready signal"
```

**Solution**: Ensure backend has been rebuilt and redeployed with the fix.

### Issue: "Transport unknown" Error
**Cause**: Socket.IO client can't reach server

**Check**:
1. Security group allows port 3001 (for direct test)
2. ALB target group is healthy: `aws elbv2 describe-target-health ...`
3. Backend is actually running: `pm2 list`

**Solution**:
```bash
# Restart backend
pm2 restart prompt-guessr-backend

# Check health
curl http://localhost:3001/health
```

### Issue: Connects Then Immediately Disconnects
**Cause**: Timeout or upgrade failure

**Check Backend Logs**:
```bash
pm2 logs --lines 200 | grep -i "disconnect\|error"
```

**Solution**: Backend fix already includes increased timeouts.

### Issue: "ERR_CONNECTION_TIMED_OUT" in Browser
**Cause**: Frontend trying to connect to wrong URL

**Check Frontend Config**:
1. Verify `NEXT_PUBLIC_SOCKET_URL` in Amplify environment variables
2. Should be: `https://<your-domain>` or `http://<alb-dns-name>`
3. NOT: `http://localhost:3001`

**Fix**:
```bash
# Update Amplify environment variable
aws amplify update-app --app-id <app-id> --environment-variables "NEXT_PUBLIC_SOCKET_URL=https://api.yoursite.com"
```

### Issue: Mixed Content Error (HTTP/HTTPS)
**Cause**: Frontend on HTTPS trying to connect to HTTP Socket.IO

**Solution**: Ensure `NEXT_PUBLIC_SOCKET_URL` uses HTTPS if frontend is HTTPS.

### Issue: CORS Error
**Cause**: Frontend origin not in CORS_ORIGIN environment variable

**Check Backend Environment**:
```bash
# On EC2
cat /home/ec2-user/prompt-guessr/prompt-guessr-backend/.env | grep CORS_ORIGIN
```

**Should Include**:
```bash
CORS_ORIGIN=https://yourfrontend.amplifyapp.com,https://www.yoursite.com
```

**Fix**:
```bash
# Update .env and restart
pm2 restart prompt-guessr-backend
```

## Diagnostic Commands

### Check All Connections
```bash
# On EC2
sudo netstat -tlnp | grep 3001
# Should show Node.js listening on 0.0.0.0:3001
```

### Check ALB Target Health
```bash
aws elbv2 describe-target-health \
  --target-group-arn <your-target-group-arn>
# Should show "healthy"
```

### Check Socket.IO Handshake
```bash
# Install wscat if needed
npm install -g wscat

# Test WebSocket connection
wscat -c "ws://<your-domain>/socket.io/?EIO=4&transport=websocket"
```

### Monitor Real-time Logs
```bash
# On EC2
pm2 logs prompt-guessr-backend --raw | grep -i "socket\|ready\|error"
```

## Rebuild & Redeploy Checklist

- [ ] 1. Pull latest code with fixes
- [ ] 2. `cd prompt-guessr-backend && npm run build`
- [ ] 3. Deploy to EC2 (via script or manual)
- [ ] 4. SSH to EC2: `pm2 restart all`
- [ ] 5. Check logs: `pm2 logs --lines 50`
- [ ] 6. Verify ready signal: `pm2 logs | grep "ready signal"`
- [ ] 7. Test health endpoint: `curl http://localhost:3001/health`
- [ ] 8. Test socket endpoint: `curl http://localhost:3001/socket.io/`
- [ ] 9. Check browser console for connection
- [ ] 10. Test ready-up functionality

## Emergency Recovery

If Socket.IO still won't work:

### Option 1: Full Process Restart
```bash
# On EC2
pm2 kill
cd /home/ec2-user/prompt-guessr/prompt-guessr-backend
pm2 start ecosystem.config.js
pm2 save
```

### Option 2: Check for Zombie Processes
```bash
# Find any Node processes
ps aux | grep node

# Kill specific PIDs if needed
kill -9 <pid>

# Restart via PM2
pm2 resurrect
```

### Option 3: Manual Start (Bypass PM2)
```bash
# For testing only
cd /home/ec2-user/prompt-guessr/prompt-guessr-backend
NODE_ENV=production PORT=3001 node dist/src/index.js
# Check if Socket.IO works this way
# Ctrl+C to stop, then restart PM2
```

## Verification Checklist

After deployment, verify:

- [ ] PM2 status shows "online" (not "launching" or "errored")
- [ ] Backend logs show "📡 Sent ready signal to PM2"
- [ ] Health endpoint returns 200: `/health`
- [ ] Socket.IO endpoint responds: `/socket.io/`
- [ ] Browser console shows "✅ Socket connected"
- [ ] Can ready up in lobby (full E2E test)
- [ ] Check backend logs show "Socket connected: <id>"

## Additional Resources

- Socket.IO Docs: https://socket.io/docs/v4/
- PM2 Wait Ready: https://pm2.keymetrics.io/docs/usage/signals-clean-restart/
- AWS ALB WebSocket: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html#websocket-support
