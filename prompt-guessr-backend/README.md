# Prompt Guessr Backend

Express.js + Socket.IO + Redis backend server for the Prompt Guessr game.

## Prerequisites

- Node.js 24+
- Redis server running on `localhost:6379` (or via Docker)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Start Redis (if using Docker):
```bash
docker run -d --name prompt-guessr-redis -p 6379:6379 redis:latest
```

## Development

```bash
npm run dev
```

Server will run on `http://localhost:3001`

## Build

```bash
npm run build
npm start
```

## Environment Variables

See `.env.example` for all available configuration options.
