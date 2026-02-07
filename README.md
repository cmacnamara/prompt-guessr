# Prompt Guessr 🎨🔮

A multiplayer party game where players submit creative prompts for AI image generation, then try to guess which prompt created which image.

## 🎮 How to Play

1. **Prompt Submit**: Each player submits an image-generation prompt
2. **Image Generation**: AI generates 4 candidate images for each prompt
3. **Image Selection**: Players privately select their favorite from their 4 images
4. **Guessing**: Revealed images are shown - players guess which prompt created which image
5. **Scoring**: Points awarded for closest guesses using similarity algorithms
6. **Results**: Leaderboard shows rankings across multiple rounds

## 🏗️ Architecture

This is a monorepo containing:

- **`prompt-guessr-backend/`** - Node.js + Express + Socket.IO backend
- **`prompt-guessr-ui/`** - Next.js 14 (App Router) frontend
- **`terraform/`** - AWS infrastructure as code
- **`docs/`** - Deployment and development documentation

### Technology Stack

**Backend:**
- Node.js 20+ with TypeScript
- Express.js for HTTP API
- Socket.IO for real-time WebSocket communication
- Redis for game state and session management
- PM2 for process management (production)

**Frontend:**
- Next.js 14 (App Router) with React 18+
- TypeScript (strict mode)
- Tailwind CSS for styling
- Socket.IO Client for real-time updates
- Zustand for client state management

**Infrastructure (AWS):**
- EC2 (t3.micro) for backend server
- ElastiCache Redis for state storage
- S3 for generated image storage
- AWS Amplify for frontend hosting
- CloudWatch for logs and monitoring

**Image Generation:**
- Pluggable provider interface
- Mock provider (development)
- HuggingFace Inference API (production)
- OpenAI DALL-E 3 (optional)

## 🚀 Local Development Setup

### Prerequisites

- Node.js 20+
- Redis (Docker recommended: `docker run -d -p 6379:6379 redis:7`)
- Git

### Backend Setup

```bash
cd prompt-guessr-backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

Backend runs on `http://localhost:3001`

### Frontend Setup

```bash
cd prompt-guessr-ui
npm install
cp .env.example .env.local
# Edit .env.local with backend URL
npm run dev
```

Frontend runs on `http://localhost:3000`

### Environment Variables

**Backend** (`.env`):
```
PORT=3001
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
IMAGE_PROVIDER=mock
HUGGINGFACE_API_KEY=your_key_here
```

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

## 📦 Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete AWS deployment guide.

### Quick Deploy

1. Configure GitHub Secrets (AWS credentials, API keys)
2. Push to `main` branch
3. GitHub Actions automatically deploys:
   - Backend to EC2 via SSH
   - Frontend to AWS Amplify
   - Infrastructure via Terraform

### Manual Deployment

```bash
# Deploy infrastructure
cd terraform
terraform init
terraform apply

# Deploy backend (SSH to EC2)
ssh ec2-user@<ec2-ip>
git clone <repo-url>
cd prompt-guessr-backend
npm ci
npm run build
pm2 start ecosystem.config.js

# Deploy frontend (automatic via Amplify GitHub integration)
```

## 🎯 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
│  (Next.js App - React Components + Socket.IO Client)        │
└─────┬───────────────────────────────────────────┬───────────┘
      │                                           │
      │ HTTP (REST)                               │ WebSocket
      │ (room create/join)                        │ (real-time events)
      │                                           │
┌─────▼───────────────────────────────────────────▼───────────┐
│                    APPLICATION SERVER                        │
│                  (Node.js + Express + Socket.IO)             │
│                         [AWS EC2]                            │
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  HTTP Routes   │  │   Socket.IO  │  │  Game Engine    │ │
│  │  (REST API)    │  │   Handlers   │  │  (State Machine)│ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Image Generation Orchestrator                │   │
│  │  (Abstract Interface → Provider Implementation)       │   │
│  └──────────────────────────────────────────────────────┘   │
└───────┬──────────────────────────────┬──────────────────────┘
        │                              │
        │                              │
    ┌───▼─────────┐              ┌─────▼────────┐
    │ ElastiCache │              │  Image Gen   │
    │   Redis     │              │  Provider    │
    │             │              │ (HuggingFace)│
    │ - Game      │              └─────┬────────┘
    │   State     │                    │
    │ - Rooms     │              ┌─────▼────────┐
    │ - Sessions  │              │   AWS S3     │
    └─────────────┘              │ (Image URLs) │
                                 └──────────────┘

       ┌──────────────────────────────┐
       │      AWS Amplify             │
       │  (Next.js Frontend Hosting)  │
       └──────────────────────────────┘
```

## 🧪 Testing

```bash
# Backend tests (when implemented)
cd prompt-guessr-backend
npm test

# Frontend tests (when implemented)
cd prompt-guessr-ui
npm test

# Full game flow test
# 1. Start backend and frontend locally
# 2. Open two browser windows
# 3. Create room, join, play through all phases
```

## 📝 Project Structure

```
prompt-guessr/
├── prompt-guessr-backend/       # Backend server
│   ├── src/
│   │   ├── socket/              # Socket.IO handlers
│   │   ├── services/            # Business logic
│   │   ├── providers/           # Image generation providers
│   │   ├── storage/             # Redis operations
│   │   └── controllers/         # HTTP endpoints
│   ├── shared/types/            # Shared TypeScript types
│   └── ecosystem.config.js      # PM2 configuration
│
├── prompt-guessr-ui/            # Frontend application
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   ├── hooks/               # React hooks (useRoom)
│   │   ├── lib/                 # Utilities and API clients
│   │   └── styles/              # Global styles
│   └── shared/types/            # Shared TypeScript types (synced)
│
├── terraform/                   # Infrastructure as Code
│   ├── modules/                 # Terraform modules (VPC, EC2, etc.)
│   ├── main.tf                  # Root configuration
│   ├── variables.tf             # Input variables
│   └── outputs.tf               # Output values
│
├── docs/                        # Documentation
│   ├── DEPLOYMENT.md            # Deployment guide
│   └── ...
│
└── .github/
    └── workflows/               # CI/CD pipelines
        ├── deploy-backend.yml
        ├── deploy-frontend.yml
        └── terraform.yml
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT

## 🔗 Links

- [Live Demo](https://main.your-amplify-domain.amplifyapp.com) *(coming soon)*
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Design Document](.github/instructions/design.instructions.md)
- [Working Log](.github/instructions/workinglog.instructions.md)

## ⚠️ Known Issues

- No timer enforcement on backend (trusts client timers)
- No reconnection handling for disconnected players
- Shared types must be manually synced between backend/frontend

## 🎯 Estimated Monthly Cost (AWS)

- **EC2 t3.micro**: Free tier (first year)
- **ElastiCache Redis**: Free tier (first year)
- **S3 Storage**: ~$0.02/month (with 30-day lifecycle)
- **Amplify Hosting**: Free tier (first year)
- **Elastic IP**: ~$4/month ⚠️ **Only ongoing cost**
- **CloudWatch Logs**: Free tier (5GB/month)

**Total**: ~$4/month after free tier expires

---

Built with ❤️ using Next.js, Node.js, Socket.IO, and AWS
