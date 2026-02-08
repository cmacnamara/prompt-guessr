#!/bin/bash
# EC2 User Data Script - Runs on first boot
# Installs Node.js, PM2, Git, and CloudWatch agent

set -e

# Update system
yum update -y

# Install Node.js 24.x (LTS)
curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
yum install -y nodejs

# Install Git
yum install -y git

# Install PM2 globally
npm install -g pm2

# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm
rm amazon-cloudwatch-agent.rpm

# Create application directory
mkdir -p /home/ec2-user/${project_name}
chown -R ec2-user:ec2-user /home/ec2-user/${project_name}

# Configure CloudWatch Logs
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'EOF'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/home/ec2-user/${project_name}/${project_name}-backend/logs/pm2-*.log",
            "log_group_name": "/aws/ec2/${project_name}-backend",
            "log_stream_name": "{instance_id}",
            "retention_in_days": 7
          }
        ]
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Print versions for verification
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PM2 version: $(pm2 --version)"
echo "Git version: $(git --version)"

# Signal completion
echo "EC2 instance initialization complete!"
