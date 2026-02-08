# Amplify Module - Frontend Hosting

# Amplify App
resource "aws_amplify_app" "frontend" {
  name       = "${var.project_name}-${var.environment}-frontend"
  repository = "https://github.com/${var.github_repository}"
  
  # OAuth token for GitHub access
  access_token = var.github_token
  
  # Build settings for Next.js
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd prompt-guessr-ui
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  EOT
  
  # Environment variables
  environment_variables = {
    NEXT_PUBLIC_API_URL     = var.backend_url
    NEXT_PUBLIC_SOCKET_URL  = var.backend_url
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
