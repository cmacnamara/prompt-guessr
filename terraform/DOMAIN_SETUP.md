# Setting Up Terraform with Custom Domain

## Quick Start

1. **Update terraform.tfvars** with your domain:
   ```hcl
   api_domain_name = "api.prompt-guessr.com"
   frontend_domain_name = "prompt-guessr.com"  # optional
   ```

2. **Run Terraform**:
   ```bash
   cd terraform
   terraform init
   terraform plan
   terraform apply
   ```

3. **Get DNS validation records**:
   ```bash
   terraform output certificate_validation_records
   terraform output dns_configuration
   ```

4. **Add DNS records to your domain registrar**

5. **Wait for certificate validation** (usually 5-30 minutes)

6. **Update Amplify environment variables** with HTTPS URLs

---

## Detailed Steps

### Step 1: Configure Your Domain

Edit `terraform/terraform.tfvars`:

```hcl
# For backend API (REQUIRED for HTTPS)
api_domain_name = "api.prompt-guessr.com"

# For frontend (OPTIONAL - custom domain in Amplify)
frontend_domain_name = "prompt-guessr.com"
```

**Domain options:**
- `api.prompt-guessr.com` - Backend API (recommended)
- `prompt-guessr.com` - Frontend (root domain)
- `www.prompt-guessr.com` - Frontend (www subdomain)

### Step 2: Apply Terraform

```bash
cd terraform
terraform apply
```

This will create:
- ACM SSL certificate for your API domain
- ALB configured with HTTPS listener
- DNS validation requirements

### Step 3: Configure DNS Records

After Terraform finishes, get the DNS records:

```bash
terraform output certificate_validation_records
```

You'll see output like:
```
[
  {
    "name" = "_abc123.api.prompt-guessr.com"
    "type" = "CNAME"
    "value" = "_xyz789.acm-validations.aws."
  }
]
```

**Add these records to your domain registrar:**

| Type  | Name                              | Value                          |
|-------|-----------------------------------|--------------------------------|
| CNAME | `_abc123.api.prompt-guessr.com`   | `_xyz789.acm-validations.aws.` |
| CNAME | `api.prompt-guessr.com`           | `<alb-dns-name>`               |

**Where to add records:**
- **GoDaddy**: DNS Management → Add Record
- **Namecheap**: Advanced DNS → Add New Record
- **Cloudflare**: DNS → Add Record
- **Route53**: Hosted Zone → Create Record

### Step 4: Wait for Certificate Validation

```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn $(terraform output -raw certificate_arn 2>/dev/null || echo "pending") \
  --region us-east-1 \
  --query 'Certificate.Status'
```

Status will change from `PENDING_VALIDATION` → `ISSUED` (usually 5-30 minutes).

### Step 5: Verify HTTPS Works

Once validated, test your backend:

```bash
curl https://api.prompt-guessr.com/health
```

Should return: `{"status":"ok"}`

### Step 6: Update Amplify Environment Variables

Go to AWS Amplify Console → Environment Variables:

```
NEXT_PUBLIC_API_URL = https://api.prompt-guessr.com
NEXT_PUBLIC_SOCKET_URL = https://api.prompt-guessr.com
```

Redeploy frontend to pick up new URLs.

---

## Troubleshooting

### Certificate stays "Pending Validation"

**Problem**: DNS validation records not found

**Solution**:
1. Check DNS propagation: `dig _abc123.api.prompt-guessr.com CNAME`
2. Verify record exactly matches Terraform output (including trailing dot)
3. Wait up to 72 hours for DNS propagation (usually faster)

### "Mixed Content" error still appears

**Problem**: Frontend still using HTTP URL

**Solutions**:
1. Check Amplify env vars are HTTPS
2. Redeploy frontend
3. Hard refresh browser (Cmd+Shift+R)
4. Check browser console for actual URL being called

### Certificate validation fails

**Problem**: Domain ownership cannot be verified

**Solution**:
1. Verify you own the domain
2. Ensure DNS records are added correctly
3. Check domain registrar's DNS settings are active
4. Wait for DNS propagation

---

## Advanced Configuration

### Using Root Domain for Frontend

If using `prompt-guessr.com` (not `www`):

1. Check if your registrar supports ALIAS/ANAME records
2. If not, use Cloudflare (free) or Route53
3. Configure in Amplify console:
   - App Settings → Domain Management
   - Add custom domain: `prompt-guessr.com`
   - Follow Amplify's DNS setup instructions

### Multiple Environments

Use different subdomains:

```hcl
# Production
api_domain_name = "api.prompt-guessr.com"

# Staging  
api_domain_name = "api-staging.prompt-guessr.com"
```

### Custom Certificate (Already Have One)

Skip ACM module and reference existing certificate:

```hcl
# In terraform/main.tf, update ALB module:
module "alb" {
  # ...
  certificate_arn = "arn:aws:acm:us-east-1:123456789:certificate/abc-123"
}
```
