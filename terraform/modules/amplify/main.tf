# Amplify Module - Frontend Hosting

# Amplify App
resource "aws_amplify_app" "frontend" {
  name       = "${var.project_name}-${var.environment}-frontend"
  repository = "https://github.com/${var.github_repository}"

  # OAuth token for GitHub access
  access_token = var.github_token

  # Platform for Next.js SSR (required for server-side rendering)
  platform = "WEB_COMPUTE"

  # Build spec is now in amplify.yml at repo root
  # Amplify will automatically detect and use it

  # Environment variables
  environment_variables = {
    NEXT_PUBLIC_API_URL    = var.backend_url
    NEXT_PUBLIC_SOCKET_URL = var.backend_url
    # For Next.js SSR in Amplify
    _LIVE_PACKAGE_UPDATES = jsonencode([{ "pkg" : "next-version", "type" : "internal", "version" : "latest" }])
  }

  # Auto-branch creation disabled (manual control)
  enable_auto_branch_creation = false
  enable_branch_auto_build    = true
  enable_branch_auto_deletion = false

  tags = {
    Name = "${var.project_name}-${var.environment}-frontend"
  }
}

# Main Branch
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "main"

  enable_auto_build = true

  framework = "Next.js - SSR"
  stage     = "PRODUCTION"

  environment_variables = {
    NEXT_PUBLIC_API_URL    = var.backend_url
    NEXT_PUBLIC_SOCKET_URL = var.backend_url
  }
}
