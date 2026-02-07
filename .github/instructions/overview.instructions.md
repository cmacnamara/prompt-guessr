---
applyTo: '**'
---
# Copilot Design Prompt: Multiplayer Prompt-Guessing Web Game

## Role
You are a senior product + full-stack engineer helping me design and implement a real-time multiplayer webapp game.  
Be opinionated, propose a clean architecture, and explicitly call out tradeoffs.  
Ask clarifying questions **only when absolutely necessary**; otherwise make reasonable assumptions and proceed.

---

## Game Concept

We are building a multiplayer party game with rounds:

1. **Prompt Submit Phase (simultaneous)**  
   Each player submits an image-generation prompt.

2. **Image Generate & Pick Phase**  
   For each prompt, generate multiple candidate images (e.g., 4).  
   The submitting player privately selects their favorite image.

3. **Reveal Phase**  
   Each chosen image is shown to all players (sequentially or as a gallery).

4. **Guess Phase**  
   For each revealed image, all *other* players submit what they believe the original prompt was.

5. **Scoring Phase**  
   The player whose guess is *closest* to the original prompt wins points.  
   “Closest” is determined by a scoring algorithm we must define.

6. **Next Round**  
   Repeat for N rounds or until a time limit; show a final leaderboard.

---

## What You Should Produce

### 1. Product Decisions (Make Assumptions)
- Room lifecycle: create room, join via code/link, lobby ready-up, start game
- Handling disconnects, reconnects, and late joins
- Host vs non-host controls
- Time limits per phase
- Max players per room
- Reveal order and guessing rules

---

### 2. Technical Architecture
Recommend and justify:
- Frontend stack (e.g., Next.js + React)
- Backend stack (e.g., Node.js)
- Real-time approach (WebSockets vs SSE)
- Server-authoritative vs client-authoritative decisions
- State synchronization strategy
- Persistent storage (Postgres / Redis / in-memory)
- Image hosting strategy (object storage, signed URLs)
- Deployment approach (simple first, scalable later)

Include an ASCII architecture diagram if helpful.

---

### 3. Data Model
Propose schemas/types for:

- User / Player (anonymous allowed)
- Session
- Room
- Game
- Round
- PromptSubmission
- GeneratedImage  
  - provider metadata  
  - generation status  
  - image URLs
- ImageSelection
- Guess
- ScoreEvent / Leaderboard

Include:
- Relationships
- Indexes
- Uniqueness constraints
- Foreign keys (or equivalents)

---

### 4. State Machine & Events

#### Game State Machine
Define:
- All phases
- Allowed transitions
- Timeouts
- Recovery from partial failure
- Idempotency considerations

#### Events
Define client ↔ server events such as:
- `ROOM_CREATED`
- `ROOM_JOINED`
- `PLAYER_READY`
- `PHASE_STARTED`
- `PROMPT_SUBMITTED`
- `IMAGES_GENERATED`
- `IMAGE_SELECTED`
- `GUESS_SUBMITTED`
- `ROUND_SCORED`
- `LEADERBOARD_UPDATED`

Include:
- Event payload shapes (TypeScript types preferred)
- Error handling strategy

---

### 5. Scoring Algorithm Options
Propose **at least three** scoring approaches:

1. **Simple baseline**  
   (keyword overlap, string similarity)

2. **Semantic similarity**  
   (embeddings / cosine similarity)

3. **Human-driven**  
   (voting, ranking, or hybrid)

For each:
- Pros / cons
- Abuse vectors
- Implementation complexity
- Cost considerations

Pick a **default** scoring approach and justify it.

---

### 6. Safety, Abuse & Moderation
Account for:
- Prompt and guess moderation (hate, harassment, profanity)
- NSFW image filtering
- Rate limiting and spam prevention
- Simple reporting / kick / ban mechanics
- Data retention and privacy considerations

MVP-level solutions are acceptable.

---

### 7. MVP Plan
Provide:
- 2–3 clear milestones
- Folder structure
- Key files/modules
- First 10 concrete implementation tasks
- Minimal UI wireframe description:
  - Lobby
  - Prompt submit
  - Image pick
  - Guessing
  - Results / leaderboard

---

### 8. Implementation Guidance
When generating code:
- Work in small vertical slices
- Prefer clarity over optimization
- Include types
- Include tests where reasonable
- Include local dev instructions
- Abstract image generation behind an interface with a mock provider

---

## Constraints & Assumptions
- Must work well on mobile and desktop
- Low latency matters
- Anonymous rooms (no auth) initially, but extensible
- Server-authoritative game state
- Image generation provider is pluggable
- Prefer deterministic outcomes where possible

---

## Deliverable Format
Start by outputting:

1. Key assumptions (bullet list)
2. Proposed architecture diagram
3. Data model
4. State machine
5. Event contracts
6. MVP milestones + first tasks

Then wait for my next instruction.
