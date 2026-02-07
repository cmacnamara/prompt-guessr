---
applyTo: '**'
---
# Prompt Guessr - Technical Design Document

## 1. Key Assumptions

### Product Decisions
- **Room Lifecycle**: 4-8 character room codes, shareable links, no registration required
- **Max Players**: 4-8 players per room (optimal: 5-6)
- **Disconnects**: 
  - Players have 60s to reconnect mid-game
  - If host disconnects, migrate host to longest-connected player
  - Late joins only allowed during lobby phase
- **Host Controls**: Host can start game, skip phases, and kick players
- **Time Limits**:
  - Prompt submit: 90s
  - Image selection: 45s (private to submitter)
  - Guessing: 60s per image
  - Results display: 15s per image
- **Reveal Order**: Sequential (one image at a time) to maintain suspense
- **Guessing Rules**: Players cannot guess on their own image
- **Rounds**: 3-5 rounds per game (configurable)

### Technical Decisions
- Server-authoritative: All game logic and state transitions on server
- Anonymous by default: No accounts needed, but extensible for future auth
- Mobile-first responsive design
- Graceful degradation for image generation failures
- Deterministic scoring with transparent results
- Image generation: 4 candidates per prompt

---

## 2. Technical Architecture

### Stack Recommendation

**Frontend:**
- **Next.js 14+ (App Router)** with React 18+
  - Server components for initial page loads
  - Client components for real-time interactions
  - Built-in API routes for simple endpoints
- **TypeScript** (strict mode)
- **Tailwind CSS** for rapid, responsive styling
- **Socket.IO Client** for WebSocket communication
- **Zustand** for client state management (lightweight, simple)

**Backend:**
- **Node.js 20+** with TypeScript
- **Express.js** for HTTP server
- **Socket.IO** for WebSocket real-time communication
  - Rooms/namespaces for game isolation
  - Automatic reconnection handling
  - Event-based architecture
- **Redis** for:
  - Room/game state (ephemeral, fast)
  - Session management
  - Pub/Sub for multi-server scaling (future)
- **PostgreSQL** (optional for MVP) for:
  - Game history
  - Analytics
  - Future user accounts

**Image Generation:**
- Pluggable provider interface
- Initial providers:
  - **Mock Provider** (instant, for development)
  - **DALL-E 3** or **Stable Diffusion** (production)
- Async generation with status polling
- S3-compatible object storage (Cloudflare R2 / AWS S3)

**Deployment (MVP):**
- Single-server deployment (Railway / Render / Fly.io)
- Redis cloud instance (Upstash / Redis Cloud)
- Object storage (Cloudflare R2 for cost)

**Future Scaling:**
- Multi-server with Redis Pub/Sub
- Load balancer with sticky sessions
- CDN for images
- Separate job queue for image generation (BullMQ)

### Architecture Diagram

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
    ┌───▼─────┐                  ┌─────▼────────┐
    │  Redis  │                  │  Image Gen   │
    │         │                  │  Provider    │
    │ - Game  │                  │  (DALL-E/SD) │
    │   State │                  └─────┬────────┘
    │ - Rooms │                        │
    │ - Sessions                       │
    └─────────┘                  ┌─────▼────────┐
                                 │   S3/R2      │
                                 │ (Image URLs) │
                                 └──────────────┘
```

### Key Architectural Decisions

1. **WebSockets (Socket.IO) over SSE**
   - ✅ Bidirectional, lower latency
   - ✅ Built-in rooms, namespaces
   - ✅ Automatic reconnection
   - ❌ More complex than SSE
   - **Verdict**: Worth it for multiplayer real-time game

2. **Redis for State Storage**
   - ✅ Fast, ephemeral (games are temporary)
   - ✅ Native pub/sub for scaling
   - ✅ TTL for auto-cleanup
   - ❌ State lost on restart (acceptable for MVP)
   - **Verdict**: Perfect for game state

3. **Server-Authoritative**
   - ✅ Prevents cheating
   - ✅ Single source of truth
   - ✅ Easier to reason about
   - ❌ Requires more server logic
   - **Verdict**: Required for fair scoring

4. **PostgreSQL (Optional for MVP)**
   - Start with Redis only
   - Add Postgres later for:
     - Game history/replays
     - User accounts
     - Analytics
   - **Verdict**: Defer to post-MVP

---

## 3. Data Model

### TypeScript Types

```typescript
// ============================================================================
// CORE ENTITIES
// ============================================================================

interface Player {
  id: string;              // UUID
  sessionId: string;       // Socket session ID
  displayName: string;     // Anonymous name (e.g., "Player 1", "Blue Llama")
  avatar?: string;         // Avatar URL or identifier
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  joinedAt: number;        // Timestamp
  lastSeenAt: number;      // For disconnect detection
}

interface Room {
  id: string;              // UUID
  code: string;            // 4-8 char code (e.g., "ABCD")
  createdAt: number;
  createdBy: string;       // Player ID
  status: 'lobby' | 'playing' | 'finished';
  hostId: string;          // Current host player ID
  players: Map<string, Player>;  // PlayerId → Player
  maxPlayers: number;      // Default: 8
  settings: RoomSettings;
}

interface RoomSettings {
  roundCount: number;           // Default: 3
  promptTimeLimit: number;      // Seconds, default: 90
  selectionTimeLimit: number;   // Seconds, default: 45
  guessingTimeLimit: number;    // Seconds, default: 60
  resultsTimeLimit: number;     // Seconds, default: 15
  imageCount: number;           // Images per prompt, default: 4
}

interface Game {
  id: string;              // UUID
  roomId: string;
  status: GameStatus;
  currentRound: number;
  rounds: Round[];
  leaderboard: Leaderboard;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

type GameStatus = 
  | 'waiting'
  | 'prompt_submit'
  | 'image_generate'
  | 'image_select'
  | 'reveal_guess'
  | 'scoring'
  | 'round_end'
  | 'game_end';

interface Round {
  id: string;
  roundNumber: number;
  prompts: Map<string, PromptSubmission>;     // PlayerId → Submission
  selections: Map<string, ImageSelection>;    // PlayerId → Selection
  guesses: Map<string, Map<string, Guess>>;   // ImageId → (GuesserId → Guess)
  scores: Map<string, number>;                // PlayerId → Round Score
  status: 'active' | 'completed';
}

interface PromptSubmission {
  playerId: string;
  prompt: string;
  submittedAt: number;
  images: GeneratedImage[];
  status: 'pending' | 'generating' | 'ready' | 'failed';
}

interface GeneratedImage {
  id: string;              // UUID
  promptId: string;        // Associated prompt submission
  playerId: string;        // Owner
  imageUrl?: string;       // S3/R2 URL (null until generated)
  thumbnailUrl?: string;   // Optimized thumbnail
  provider: 'mock' | 'dalle3' | 'stable-diffusion';
  providerImageId?: string;
  status: 'queued' | 'generating' | 'complete' | 'failed';
  generatedAt?: number;
  metadata?: {
    model?: string;
    revisedPrompt?: string;  // DALL-E sometimes revises
    generationTime?: number;
  };
}

interface ImageSelection {
  playerId: string;
  imageId: string;         // Which image from their 4 candidates
  selectedAt: number;
}

interface Guess {
  id: string;
  imageId: string;         // Which image they're guessing about
  playerId: string;        // Who submitted the guess
  guessText: string;       // Their guessed prompt
  submittedAt: number;
  score?: number;          // Calculated similarity (0-100)
}

interface ScoreEvent {
  roundNumber: number;
  imageId: string;
  originalPrompt: string;
  winningGuess: Guess;
  allGuesses: Guess[];
  pointsAwarded: Map<string, number>;  // PlayerId → Points
}

interface Leaderboard {
  scores: Map<string, PlayerScore>;  // PlayerId → PlayerScore
  rankings: string[];                // Ordered player IDs
}

interface PlayerScore {
  playerId: string;
  displayName: string;
  totalScore: number;
  roundScores: number[];    // Score per round
  guessWins: number;        // Times they had winning guess
  promptPicks: number;      // Times their image was correctly guessed
}
```

### Redis Schema (Key Design)

```
# Room keys
room:{roomId}                    → Room JSON
room:code:{code}                 → roomId (index)
room:{roomId}:ttl                → 24 hours

# Game keys
game:{gameId}                    → Game JSON
game:{gameId}:round:{roundNum}   → Round JSON

# Session keys
session:{sessionId}              → Player JSON
session:{sessionId}:ttl          → 2 hours (extend on activity)

# Indexes
active_rooms                     → Set of active room IDs
```

### PostgreSQL Schema (Future - Optional)

```sql
-- For game history and analytics
CREATE TABLE games (
  id UUID PRIMARY KEY,
  room_code VARCHAR(8),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  player_count INTEGER,
  round_count INTEGER
);

CREATE TABLE game_players (
  game_id UUID REFERENCES games(id),
  player_name VARCHAR(50),
  final_score INTEGER,
  ranking INTEGER,
  PRIMARY KEY (game_id, player_name)
);

CREATE TABLE prompts_history (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  player_name VARCHAR(50),
  prompt TEXT,
  selected_image_url TEXT,
  created_at TIMESTAMPTZ
);

CREATE INDEX idx_games_created ON games(started_at DESC);
```

---

## 4. State Machine & Events

### Game State Machine

```
┌─────────────┐
│   WAITING   │ (Lobby - players joining)
└──────┬──────┘
       │ host clicks "Start Game"
       │ → validate min 2 players
       ▼
┌─────────────┐
│PROMPT_SUBMIT│ (All players submit prompts)
└──────┬──────┘  Timer: 90s
       │ → all prompts submitted OR timeout
       ▼
┌─────────────┐
│IMAGE_GENERATE│ (Async - server generates images)
└──────┬──────┘  No timer (wait for completion)
       │ → all images ready OR failures handled
       ▼
┌─────────────┐
│IMAGE_SELECT │ (Each player picks favorite from their 4)
└──────┬──────┘  Timer: 45s (per player, can parallelize UI)
       │ → all selections made OR timeout (auto-select first)
       ▼
┌─────────────┐
│REVEAL_GUESS │ (Show image 1, everyone guesses, repeat)
└──────┬──────┘  Timer: 60s per image
       │ → all images shown & guessed
       ▼
┌─────────────┐
│   SCORING   │ (Calculate scores, determine winners)
└──────┬──────┘  Server-side, <1s
       │
       ▼
┌─────────────┐
│  ROUND_END  │ (Show round results, leaderboard)
└──────┬──────┘  Timer: 15s
       │
       ├─→ more rounds? → PROMPT_SUBMIT (next round)
       │
       └─→ no more rounds ▼
       ┌─────────────┐
       │  GAME_END   │ (Final leaderboard, replay option)
       └─────────────┘
```

### State Transitions (Server Logic)

```typescript
type StateTransition = {
  from: GameStatus;
  to: GameStatus;
  condition: (game: Game) => boolean;
  action?: (game: Game) => Promise<void>;
  timeout?: number;  // Auto-transition after N seconds
};

const STATE_MACHINE: StateTransition[] = [
  {
    from: 'waiting',
    to: 'prompt_submit',
    condition: (g) => g.roomId.players.size >= 2,
    action: startRound,
  },
  {
    from: 'prompt_submit',
    to: 'image_generate',
    condition: (g) => allPromptsSubmitted(g) || timeoutReached(g),
    timeout: 90,
    action: queueImageGeneration,
  },
  {
    from: 'image_generate',
    to: 'image_select',
    condition: (g) => allImagesReady(g),
    action: notifyPlayersToSelect,
  },
  {
    from: 'image_select',
    to: 'reveal_guess',
    condition: (g) => allSelectionsComplete(g) || timeoutReached(g),
    timeout: 45,
    action: prepareRevealQueue,
  },
  {
    from: 'reveal_guess',
    to: 'scoring',
    condition: (g) => allImagesRevealed(g) && allGuessesSubmitted(g),
    action: calculateScores,
  },
  {
    from: 'scoring',
    to: 'round_end',
    condition: () => true,
    action: broadcastScores,
  },
  {
    from: 'round_end',
    to: 'prompt_submit',
    condition: (g) => g.currentRound < g.settings.roundCount,
    timeout: 15,
    action: incrementRound,
  },
  {
    from: 'round_end',
    to: 'game_end',
    condition: (g) => g.currentRound >= g.settings.roundCount,
    timeout: 15,
    action: finalizeGame,
  },
];
```

### Idempotency & Recovery

- **Idempotent Events**: All client events include requestId (UUID)
  - Server deduplicates within 5-minute window
- **Partial Failure Recovery**:
  - Image generation failures: Use placeholder image, continue game
  - Player disconnect during prompt submit: Use their previous prompt or skip
  - Host disconnect: Auto-migrate to next player
- **State Reconciliation**:
  - On reconnect, send full game state snapshot
  - Client validates local state, replaces if mismatch

---

## 5. Event Contracts

### Client → Server Events

```typescript
// ============================================================================
// ROOM & LOBBY
// ============================================================================

interface CreateRoomRequest {
  playerName: string;
  settings?: Partial<RoomSettings>;
}

interface CreateRoomResponse {
  roomId: string;
  roomCode: string;
  playerId: string;
}

interface JoinRoomRequest {
  roomCode: string;
  playerName: string;
}

interface JoinRoomResponse {
  roomId: string;
  playerId: string;
  room: Room;
}

interface PlayerReadyRequest {
  roomId: string;
  playerId: string;
  isReady: boolean;
}

interface StartGameRequest {
  roomId: string;
  playerId: string;  // Must be host
}

// ============================================================================
// GAMEPLAY
// ============================================================================

interface SubmitPromptRequest {
  gameId: string;
  playerId: string;
  prompt: string;
  requestId: string;  // For idempotency
}

interface SelectImageRequest {
  gameId: string;
  playerId: string;
  imageId: string;
  requestId: string;
}

interface SubmitGuessRequest {
  gameId: string;
  playerId: string;
  imageId: string;
  guessText: string;
  requestId: string;
}

interface KickPlayerRequest {
  roomId: string;
  hostId: string;
  targetPlayerId: string;
}
```

### Server → Client Events

```typescript
// ============================================================================
// ROOM EVENTS
// ============================================================================

interface RoomCreatedEvent {
  room: Room;
}

interface PlayerJoinedEvent {
  player: Player;
  room: Room;
}

interface PlayerLeftEvent {
  playerId: string;
  reason: 'disconnect' | 'kicked' | 'left';
  newHostId?: string;  // If host changed
}

interface PlayerReadyEvent {
  playerId: string;
  isReady: boolean;
}

// ============================================================================
// GAME PHASE EVENTS
// ============================================================================

interface PhaseChangedEvent {
  gameId: string;
  phase: GameStatus;
  phaseData: any;  // Phase-specific data
  timeLimit?: number;  // Seconds for this phase
  expiresAt?: number;  // Timestamp when auto-transition happens
}

interface PromptSubmitPhaseData {
  roundNumber: number;
}

interface ImageSelectPhaseData {
  images: Map<string, GeneratedImage[]>;  // PlayerId → their 4 images
}

interface RevealGuessPhaseData {
  currentImageIndex: number;
  totalImages: number;
  currentImage: {
    id: string;
    imageUrl: string;
    submitterId: string;  // Hidden until after guessing
  };
}

// ============================================================================
// SUBMISSION EVENTS
// ============================================================================

interface PromptSubmittedEvent {
  playerId: string;
  status: 'submitted' | 'pending' | 'timeout';
  remainingPlayers: string[];
}

interface ImagesGeneratedEvent {
  playerId: string;
  images: GeneratedImage[];  // Only sent to that player
}

interface ImageSelectedEvent {
  playerId: string;
  // Image ID is private - not broadcast
}

interface GuessSubmittedEvent {
  playerId: string;
  imageId: string;
  // Guess text is private until scoring
}

// ============================================================================
// SCORING EVENTS
// ============================================================================

interface RoundScoredEvent {
  roundNumber: number;
  results: ImageResult[];
  leaderboard: Leaderboard;
}

interface ImageResult {
  imageId: string;
  imageUrl: string;
  submitterId: string;
  submitterName: string;
  originalPrompt: string;
  guesses: Array<{
    playerId: string;
    playerName: string;
    guessText: string;
    score: number;  // 0-100 similarity
  }>;
  winningGuess?: {
    playerId: string;
    playerName: string;
    guessText: string;
    score: number;
  };
}

interface LeaderboardUpdatedEvent {
  leaderboard: Leaderboard;
}

interface GameEndedEvent {
  winner: {
    playerId: string;
    displayName: string;
    totalScore: number;
  };
  leaderboard: Leaderboard;
  gameId: string;
}

// ============================================================================
// ERROR EVENTS
// ============================================================================

interface ErrorEvent {
  code: string;
  message: string;
  context?: any;
}

// Common error codes:
// - ROOM_FULL
// - GAME_IN_PROGRESS
// - NOT_HOST
// - INVALID_PHASE
// - TIMEOUT
// - GENERATION_FAILED
```

### Error Handling Strategy

```typescript
// Client sends events with error callbacks
socket.emit('submit_prompt', data, (response: { success: boolean; error?: string }) => {
  if (!response.success) {
    showError(response.error);
  }
});

// Server broadcasts errors to specific clients
socket.to(playerId).emit('error', {
  code: 'INVALID_PHASE',
  message: 'Cannot submit prompt in current game phase',
});

// Global error handler
socket.on('error', (error) => {
  logger.error('Socket error', error);
  // Attempt reconnection
});
```

---

## 6. Scoring Algorithm Options

### Option 1: Simple Keyword + Fuzzy Match (BASELINE)

**Algorithm:**
```typescript
function scoreGuess(original: string, guess: string): number {
  const originalTokens = tokenize(original.toLowerCase());
  const guessTokens = tokenize(guess.toLowerCase());
  
  // 1. Exact match
  if (original.toLowerCase() === guess.toLowerCase()) return 100;
  
  // 2. Fuzzy string similarity (Levenshtein distance)
  const stringSimilarity = calculateLevenshtein(original, guess);
  
  // 3. Keyword overlap (Jaccard similarity)
  const intersection = originalTokens.filter(t => guessTokens.includes(t));
  const union = new Set([...originalTokens, ...guessTokens]);
  const keywordSimilarity = intersection.length / union.size;
  
  // 4. Weighted combination
  return Math.round((stringSimilarity * 0.4 + keywordSimilarity * 0.6) * 100);
}
```

**Pros:**
- ✅ Fast, deterministic, no external API
- ✅ Zero cost
- ✅ Easy to understand and explain to players
- ✅ Works offline

**Cons:**
- ❌ Misses semantic similarity ("cat" vs "feline")
- ❌ Word order matters too much
- ❌ Easy to game with keyword stuffing

**Abuse Vectors:**
- Players could stuff common words
- Doesn't understand synonyms or paraphrasing

**Implementation Complexity:** Low (1-2 hours)

**Cost:** $0

---

### Option 2: Semantic Embeddings (OpenAI / Sentence Transformers)

**Algorithm:**
```typescript
async function scoreGuess(original: string, guess: string): Promise<number> {
  // Generate embeddings
  const originalEmbedding = await getEmbedding(original);
  const guessEmbedding = await getEmbedding(guess);
  
  // Cosine similarity
  const similarity = cosineSimilarity(originalEmbedding, guessEmbedding);
  
  // Scale to 0-100
  return Math.round(similarity * 100);
}

async function getEmbedding(text: string): Promise<number[]> {
  // Option A: OpenAI Embeddings API (text-embedding-3-small)
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
  
  // Option B: Self-hosted (Sentence Transformers via Docker)
  // const response = await fetch('http://localhost:8000/embed', {
  //   method: 'POST',
  //   body: JSON.stringify({ text }),
  // });
}
```

**Pros:**
- ✅ Understands semantic similarity ("cat" = "feline")
- ✅ Handles paraphrasing well
- ✅ More fair and accurate

**Cons:**
- ❌ API cost (OpenAI: ~$0.00002 per prompt)
- ❌ Latency (~200-500ms per API call)
- ❌ Requires external dependency
- ❌ Self-hosted option adds infrastructure complexity

**Abuse Vectors:**
- Minimal - hard to game semantic similarity

**Implementation Complexity:** Medium (4-6 hours with caching)

**Cost (per game):**
- 4 players × 3 rounds × 4 images × 3 guesses = ~144 embeddings
- OpenAI: $0.00002 × 144 × 2 (original + guess) = ~$0.006 per game
- Self-hosted: Infrastructure cost (~$10-20/month)

---

### Option 3: Hybrid Approach (Baseline + LLM Judge)

**Algorithm:**
```typescript
async function scoreGuess(
  original: string,
  guess: string,
  imageUrl: string
): Promise<number> {
  // Fast baseline filter
  const baselineScore = calculateBaseline(original, guess);
  
  if (baselineScore > 90) return baselineScore;  // Obviously correct
  if (baselineScore < 10) return baselineScore;  // Obviously wrong
  
  // Use LLM for ambiguous cases (10-90)
  const llmScore = await getLLMScore(original, guess, imageUrl);
  
  // Weighted combination
  return Math.round(baselineScore * 0.3 + llmScore * 0.7);
}

async function getLLMScore(
  original: string,
  guess: string,
  imageUrl: string
): Promise<number> {
  const prompt = `
You are a judge for a prompt-guessing game.

Original prompt: "${original}"
Player's guess: "${guess}"
Generated image: [attached]

Rate how close the guess is to the original prompt on a scale of 0-100.
Consider:
- Semantic similarity (synonyms are good)
- Key concepts captured
- Overall intent

Respond with ONLY a number 0-100.
  `.trim();
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',  // Cheap and fast
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 10,
  });
  
  return parseInt(response.choices[0].message.content || '0', 10);
}
```

**Pros:**
- ✅ Best accuracy (LLM understands nuance + image context)
- ✅ Only pays for ambiguous cases (reduces cost)
- ✅ Leverages image to resolve ambiguity
- ✅ Players trust AI judge

**Cons:**
- ❌ Higher cost than embeddings
- ❌ Slower (1-2s per LLM call)
- ❌ Non-deterministic (minor variance in scores)
- ❌ More complex implementation

**Abuse Vectors:**
- Hard to game (LLM is robust)

**Implementation Complexity:** High (8-12 hours)

**Cost (per game):**
- ~30% of guesses need LLM (ambiguous)
- 144 total guesses × 0.3 = ~43 LLM calls
- GPT-4o-mini: $0.00015/1K input + $0.0006/1K output
- ~$0.05 per game (assuming vision + text)

---

### Option 4: Player Voting (Human-Driven)

**Algorithm:**
```typescript
// After all guesses submitted, show players all guesses for each image
// Players vote on which guess is closest

interface VotingPhase {
  imageId: string;
  originalPrompt: string;  // Hidden until after voting
  guesses: Array<{
    id: string;
    text: string;
    playerId: string;  // Hidden
  }>;
}

// Each player votes (cannot vote for own guess)
// Winner = most votes
// Ties: split points
```

**Pros:**
- ✅ Zero cost
- ✅ Social/fun element
- ✅ No complex scoring logic
- ✅ Players understand the system

**Cons:**
- ❌ Slow (adds 30-60s per image)
- ❌ Vulnerable to collusion
- ❌ Popularity contest (not accuracy)
- ❌ Doesn't scale to many players

**Abuse Vectors:**
- Players can collude to vote for friends
- Strategic voting to block leaders

**Implementation Complexity:** Medium (6-8 hours)

**Cost:** $0

---

### **RECOMMENDED: Option 1 (Simple Baseline) for MVP**

**Justification:**
- **Fast to implement**: Get to playable prototype in days
- **Zero cost**: No API fees, sustainable
- **Deterministic**: Consistent results, easier to debug
- **Transparent**: Players can understand how scores work
- **Extensible**: Can upgrade to Option 2 or 3 later

**Implementation Plan:**
1. Start with basic Levenshtein + keyword overlap
2. Tune weights based on playtesting
3. Add normalization (remove punctuation, lowercase, etc.)
4. Monitor for abuse patterns
5. **Phase 2**: Add embeddings for ties/close scores
6. **Phase 3**: Optional LLM judge for tournaments

**Fallback Strategy:**
If baseline proves too gameable:
- Upgrade to Option 2 (embeddings) - minimal code change
- Cache embeddings aggressively to reduce API calls
- Self-host Sentence Transformers if volume is high

---

## 7. Safety, Abuse & Moderation

### Prompt & Guess Moderation

**MVP Approach:**
```typescript
// Client-side prevention (UX)
const BLOCKED_WORDS = ['...'];  // Basic profanity list
const MAX_PROMPT_LENGTH = 200;
const MIN_PROMPT_LENGTH = 3;

// Server-side validation
function validatePrompt(text: string): { valid: boolean; reason?: string } {
  if (text.length < MIN_PROMPT_LENGTH) {
    return { valid: false, reason: 'Prompt too short' };
  }
  if (text.length > MAX_PROMPT_LENGTH) {
    return { valid: false, reason: 'Prompt too long' };
  }
  if (containsBlockedWords(text)) {
    return { valid: false, reason: 'Inappropriate content' };
  }
  return { valid: true };
}

// Optional: OpenAI Moderation API (free)
async function moderateText(text: string): Promise<boolean> {
  const response = await openai.moderations.create({ input: text });
  return !response.results[0].flagged;
}
```

**Future:**
- Integrate moderation API (OpenAI Moderation - free)
- Player reporting with threshold-based auto-kick
- Human review queue for reports

---

### NSFW Image Filtering

**MVP Approach:**
```typescript
// Rely on DALL-E's built-in safety filters
// DALL-E 3 rejects NSFW prompts before generation

// For Stable Diffusion:
interface SDConfig {
  safetyFilter: 'strict' | 'moderate' | 'none';
}

// Post-generation check (optional)
async function checkImageSafety(imageUrl: string): Promise<boolean> {
  // Use AWS Rekognition, Google Vision, or Sightengine
  const response = await visionAPI.detectExplicitContent(imageUrl);
  return response.isExplicit === false;
}
```

**Future:**
- Add NSFW detection service
- Player-reported images reviewed by moderators

---

### Rate Limiting & Spam Prevention

```typescript
// Per-player limits (Redis)
const RATE_LIMITS = {
  createRoom: { maxRequests: 5, windowMs: 60000 },      // 5 rooms/min
  joinRoom: { maxRequests: 10, windowMs: 60000 },       // 10 joins/min
  submitPrompt: { maxRequests: 1, windowMs: 5000 },     // 1 per 5s
  submitGuess: { maxRequests: 1, windowMs: 2000 },      // 1 per 2s
};

// Middleware
async function rateLimit(
  playerId: string,
  action: string
): Promise<boolean> {
  const key = `ratelimit:${playerId}:${action}`;
  const limit = RATE_LIMITS[action];
  
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, limit.windowMs / 1000);
  }
  
  return count <= limit.maxRequests;
}
```

---

### Kick / Ban Mechanics

**MVP:**
```typescript
// Host can kick players during lobby or game
function kickPlayer(roomId: string, hostId: string, targetId: string) {
  // Validate host
  // Remove player from room
  // Emit PLAYER_LEFT event
  // Add to room ban list (temporary, expires with room)
}

interface Room {
  bannedPlayers: Set<string>;  // Player IDs
}

// Prevent re-joining
function canJoinRoom(playerId: string, room: Room): boolean {
  return !room.bannedPlayers.has(playerId);
}
```

**Future:**
- Global ban list (IP-based or account-based)
- Report system with threshold auto-ban
- Moderator dashboard

---

### Data Retention & Privacy

**MVP:**
```typescript
// Ephemeral by default
const TTL = {
  room: 24 * 60 * 60,        // 24 hours
  game: 24 * 60 * 60,        // 24 hours
  session: 2 * 60 * 60,      // 2 hours (refreshed on activity)
  images: 7 * 24 * 60 * 60,  // 7 days (object storage)
};

// Auto-cleanup
setInterval(() => {
  cleanupExpiredRooms();
  cleanupExpiredSessions();
}, 60000);  // Every minute
```

**Privacy:**
- No personal data collected (anonymous by default)
- No email, no passwords
- Player names are ephemeral
- Images auto-delete after 7 days
- No tracking cookies (analytics optional)

**Future:**
- Optional account system (email, OAuth)
- GDPR-compliant data export
- Right to deletion

---

## 8. MVP Plan

### Milestones

#### **Milestone 1: Core Infrastructure (Week 1)**
**Goal:** Lobby + room system working

**Deliverables:**
- ✅ Create/join room via code
- ✅ Player management (join, leave, disconnect, reconnect)
- ✅ Host migration
- ✅ Ready-up system
- ✅ WebSocket connection established
- ✅ Basic UI: Lobby screen

**Tasks:**
1. Set up Next.js + TypeScript project
2. Set up Express + Socket.IO server
3. Set up Redis (local dev + cloud)
4. Implement room creation/join REST endpoints
5. Implement Socket.IO room events
6. Build lobby UI component
7. Implement player list component
8. Add ready-up toggle
9. Add host controls (start game, kick)
10. Test with 4+ concurrent connections

---

#### **Milestone 2: Core Game Loop (Week 2)**
**Goal:** Full single-round gameplay (no image generation yet)

**Deliverables:**
- ✅ State machine working
- ✅ Prompt submission phase
- ✅ Mock image generation (instant placeholders)
- ✅ Image selection phase
- ✅ Reveal & guess phase (sequential)
- ✅ Scoring phase
- ✅ Leaderboard display
- ✅ Basic UI for all phases

**Tasks:**
1. Implement game state machine
2. Build prompt submission UI + handler
3. Implement mock image provider (returns placeholders)
4. Build image selection UI (4-grid selector)
5. Build reveal/guess UI (image + text input)
6. Implement baseline scoring algorithm
7. Build scoring results screen
8. Build leaderboard component
9. Add phase timers (client + server)
10. Test complete round with 3 players

---

#### **Milestone 3: Production-Ready (Week 3-4)**
**Goal:** Real image generation + polish

**Deliverables:**
- ✅ Real image generation (DALL-E 3 or SD)
- ✅ Multi-round support
- ✅ Error handling & recovery
- ✅ Mobile-responsive design
- ✅ Moderation basics
- ✅ Deploy to production

**Tasks:**
1. Implement DALL-E 3 provider
2. Add image generation status polling
3. Set up S3/R2 for image storage
4. Handle generation failures gracefully
5. Add multi-round logic
6. Implement final leaderboard screen
7. Add text moderation (basic)
8. Polish UI/UX (animations, loading states)
9. Test on mobile devices
10. Deploy to Railway/Render + Redis Cloud

---

### Folder Structure

```
prompt-guessr/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing page
│   │   ├── room/
│   │   │   └── [code]/
│   │   │       └── page.tsx    # Game room UI
│   │   └── api/                # REST endpoints
│   │       ├── rooms/create/route.ts
│   │       └── rooms/join/route.ts
│   │
│   ├── components/             # React components
│   │   ├── lobby/
│   │   │   ├── PlayerList.tsx
│   │   │   ├── ReadyButton.tsx
│   │   │   └── RoomSettings.tsx
│   │   ├── game/
│   │   │   ├── PromptSubmit.tsx
│   │   │   ├── ImageSelector.tsx
│   │   │   ├── RevealGuess.tsx
│   │   │   ├── ScoreDisplay.tsx
│   │   │   └── Leaderboard.tsx
│   │   └── shared/
│   │       ├── Timer.tsx
│   │       └── Avatar.tsx
│   │
│   ├── lib/                    # Shared utilities
│   │   ├── socket-client.ts    # Socket.IO client wrapper
│   │   ├── game-state.ts       # Client state management (Zustand)
│   │   └── utils.ts
│   │
│   ├── types/                  # Shared TypeScript types
│   │   ├── game.ts
│   │   ├── room.ts
│   │   └── events.ts
│   │
│   └── styles/
│       └── globals.css
│
├── server/                     # Backend (Node.js)
│   ├── index.ts                # Entry point
│   ├── socket/                 # Socket.IO handlers
│   │   ├── index.ts
│   │   ├── room-handlers.ts
│   │   └── game-handlers.ts
│   │
│   ├── services/               # Business logic
│   │   ├── room-service.ts
│   │   ├── game-service.ts
│   │   ├── state-machine.ts
│   │   └── scoring-service.ts
│   │
│   ├── providers/              # Image generation
│   │   ├── image-provider.interface.ts
│   │   ├── mock-provider.ts
│   │   └── dalle-provider.ts
│   │
│   ├── storage/                # Data layer
│   │   ├── redis-client.ts
│   │   ├── room-repository.ts
│   │   └── game-repository.ts
│   │
│   ├── middleware/
│   │   ├── rate-limit.ts
│   │   └── validation.ts
│   │
│   └── utils/
│       ├── code-generator.ts   # Room codes
│       └── logger.ts
│
├── shared/                     # Shared between client/server
│   └── types/                  # (symlinked to src/types)
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── public/
│   └── images/
│       └── placeholder.png
│
├── .env.example
├── .env.local
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── README.md
```

---

### Key Files & Modules

#### **Client (Next.js)**

**`src/lib/socket-client.ts`** - WebSocket client wrapper
```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

export function connectSocket(playerId: string, roomId: string) {
  const socket = getSocket();
  socket.auth = { playerId, roomId };
  socket.connect();
}

export function disconnectSocket() {
  socket?.disconnect();
}
```

**`src/lib/game-state.ts`** - Client state (Zustand)
```typescript
import { create } from 'zustand';

interface GameState {
  room: Room | null;
  game: Game | null;
  currentPlayerId: string | null;
  setRoom: (room: Room) => void;
  setGame: (game: Game) => void;
  updatePhase: (phase: GameStatus) => void;
}

export const useGameStore = create<GameState>((set) => ({
  room: null,
  game: null,
  currentPlayerId: null,
  setRoom: (room) => set({ room }),
  setGame: (game) => set({ game }),
  updatePhase: (phase) => set((state) => ({
    game: state.game ? { ...state.game, status: phase } : null,
  })),
}));
```

---

#### **Server (Node.js)**

**`server/index.ts`** - Entry point
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './socket';
import { initRedis } from './storage/redis-client';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL },
});

app.use(express.json());

// REST endpoints
app.post('/api/rooms/create', createRoomHandler);
app.post('/api/rooms/join', joinRoomHandler);

// Socket.IO
setupSocketHandlers(io);

// Start
await initRedis();
httpServer.listen(3001, () => {
  console.log('Server running on :3001');
});
```

**`server/services/state-machine.ts`** - Game state logic
```typescript
export class GameStateMachine {
  async transition(game: Game, to: GameStatus): Promise<void> {
    const transition = STATE_MACHINE.find(
      (t) => t.from === game.status && t.to === to
    );
    
    if (!transition) {
      throw new Error(`Invalid transition: ${game.status} → ${to}`);
    }
    
    if (!transition.condition(game)) {
      throw new Error(`Condition not met for transition to ${to}`);
    }
    
    game.status = to;
    await transition.action?.(game);
    await saveGame(game);
    
    // Auto-transition if timeout set
    if (transition.timeout) {
      setTimeout(() => {
        this.autoTransition(game);
      }, transition.timeout * 1000);
    }
  }
}
```

**`server/providers/image-provider.interface.ts`** - Abstraction
```typescript
export interface ImageProvider {
  generateImages(prompt: string, count: number): Promise<GeneratedImage[]>;
  getProviderName(): string;
}

export class MockProvider implements ImageProvider {
  async generateImages(prompt: string, count: number): Promise<GeneratedImage[]> {
    return Array.from({ length: count }, (_, i) => ({
      id: uuid(),
      promptId: '',
      playerId: '',
      imageUrl: `https://via.placeholder.com/512?text=${encodeURIComponent(prompt)}-${i}`,
      provider: 'mock',
      status: 'complete',
      generatedAt: Date.now(),
    }));
  }
  
  getProviderName() { return 'mock'; }
}
```

---

### First 10 Implementation Tasks

1. **Initialize Next.js + TypeScript project**
   - `npx create-next-app@latest --typescript --tailwind --app`
   - Configure ESLint, Prettier
   - Set up folder structure

2. **Set up Express + Socket.IO server**
   - Create `server/` directory
   - Install dependencies: `express`, `socket.io`, `typescript`
   - Create basic HTTP + WebSocket server

3. **Set up Redis (local + cloud)**
   - Install `redis` client
   - Docker Compose for local dev
   - Create `redis-client.ts` wrapper

4. **Define shared TypeScript types**
   - Create `shared/types/` folder
   - Define all interfaces from data model section
   - Symlink to `src/types` and `server/types`

5. **Implement room creation REST endpoint**
   - POST `/api/rooms/create`
   - Generate unique 4-char room code
   - Store room in Redis
   - Return `roomId` and `code`

6. **Implement room join REST endpoint**
   - POST `/api/rooms/join` with `roomCode`
   - Validate room exists and not full
   - Add player to room
   - Return room state

7. **Build lobby UI (React)**
   - Create `RoomPage.tsx`
   - Display room code, player list
   - Show ready status for each player
   - Host sees "Start Game" button

8. **Implement Socket.IO room events**
   - `player:join`, `player:leave`, `player:ready`
   - Broadcast to all clients in room
   - Handle disconnect/reconnect

9. **Create mock image provider**
   - Implement `MockProvider` class
   - Returns placeholder images instantly
   - No external API calls

10. **Build prompt submission UI + handler**
    - Create `PromptSubmit.tsx` component
    - Text input + submit button
    - Socket event: `prompt:submit`
    - Server validates and stores
    - Broadcast submission count

---

### UI Wireframes (Minimal Description)

#### **1. Lobby**
```
┌────────────────────────────────────┐
│  PROMPT GUESSR                     │
├────────────────────────────────────┤
│  Room Code: ABCD  [Copy Link]     │
│                                    │
│  Players (3/8):                    │
│  👤 Player1 (Host) ✓ Ready        │
│  👤 Player2        ✓ Ready        │
│  👤 Player3        ⏳ Not Ready    │
│                                    │
│  [Ready Up]    [Start Game] ← Host│
└────────────────────────────────────┘
```

#### **2. Prompt Submit**
```
┌────────────────────────────────────┐
│  Round 1 - Submit Your Prompt      │
│  ⏱️ 1:23 remaining                 │
├────────────────────────────────────┤
│  ┌─────────────────────────────┐  │
│  │ Enter image prompt...       │  │
│  │                             │  │
│  └─────────────────────────────┘  │
│                                    │
│  [Submit Prompt]                   │
│                                    │
│  Waiting for:                      │
│  • Player2  • Player3              │
└────────────────────────────────────┘
```

#### **3. Image Pick (Private)**
```
┌────────────────────────────────────┐
│  Pick Your Favorite Image          │
│  Prompt: "a cat wearing a hat"     │
├────────────────────────────────────┤
│  ┌─────┐ ┌─────┐                   │
│  │ IMG │ │ IMG │ ← Click to select │
│  │  1  │ │  2  │                   │
│  └─────┘ └─────┘                   │
│  ┌─────┐ ┌─────┐                   │
│  │ IMG │ │ IMG │                   │
│  │  3  │ │  4  │                   │
│  └─────┘ └─────┘                   │
│                                    │
│  [Confirm Selection]               │
└────────────────────────────────────┘
```

#### **4. Guessing**
```
┌────────────────────────────────────┐
│  Image 1 of 4 - Guess the Prompt   │
│  ⏱️ 0:45 remaining                 │
├────────────────────────────────────┤
│  ┌────────────────────────────┐   │
│  │                            │   │
│  │      [REVEALED IMAGE]      │   │
│  │                            │   │
│  └────────────────────────────┘   │
│                                    │
│  What was the prompt?              │
│  ┌─────────────────────────────┐  │
│  │ Your guess...               │  │
│  └─────────────────────────────┘  │
│                                    │
│  [Submit Guess]                    │
│                                    │
│  ✓ Player1 submitted               │
│  ⏳ Waiting for Player3...         │
└────────────────────────────────────┘
```

#### **5. Results**
```
┌────────────────────────────────────┐
│  Round 1 Results                   │
├────────────────────────────────────┤
│  Image 1 (by Player1)              │
│  Original: "a cat wearing a hat"   │
│                                    │
│  Guesses:                          │
│  🥇 Player2: "cat in hat" (95)    │
│  🥈 Player3: "feline headwear" (78)│
│                                    │
│  ─────────────────────────────     │
│                                    │
│  Leaderboard:                      │
│  1. Player2 - 150 pts              │
│  2. Player1 - 120 pts              │
│  3. Player3 - 90 pts               │
│                                    │
│  [Next Round]                      │
└────────────────────────────────────┘
```

---

## Summary

This design provides:

✅ **Opinionated architecture** - Next.js + Express + Socket.IO + Redis  
✅ **Complete data model** - All entities, relationships, events  
✅ **Deterministic state machine** - Clear phase transitions  
✅ **Pragmatic MVP scope** - 3-4 week timeline  
✅ **Extensible foundation** - Can add auth, DB, advanced scoring later  
✅ **Safety considerations** - Moderation, rate limiting, privacy  

**Next Steps:**
- Review and approve this design
- I'll begin implementation starting with Milestone 1, Task 1
- Or specify changes/additions you'd like

Ready to proceed when you are! 🚀
