---
applyTo: '**'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

# Working Log & Instructions

## 🔴 CRITICAL: Read This First
**Before responding to ANY user request, read this ENTIRE file to understand:**
- Current project state and architecture
- Recent work completed
- Known issues and solutions
- User's learning preferences
- Next steps in development

**After EVERY code change or problem resolution:**
- Update the "Recent Work Completed" section with what was changed
- Add any new problems encountered to "Major Problems Solved"
- Update "Current State" to reflect new functionality
- Update "Last Updated" timestamp at bottom
- Keep this file as the single source of truth for session context

---

## User Preferences & Guidelines

### Communication Style
- **One file at a time**: User explicitly requested "only edit one file at a time"
- **Pause for confirmation**: Ask before editing files to facilitate learning
- **Explain WHY**: User wants to understand reasoning, not just see changes
- **No "key concepts" commentary**: Don't explicitly call out learning concepts or tell them what they demonstrate
- **Be concise**: Short, direct answers unless complexity requires detail

### Code Quality Expectations
- Fix linting errors when pointed out (e.g., SonarQube warnings)
- Avoid unnecessary type assertions
- Prefer helper functions over inline complexity
- Add explanatory comments for non-obvious code

---

## Project Overview

### What We're Building
**Prompt Guessr** - A multiplayer game where players:
1. Submit creative prompts for AI image generation
2. AI generates images from prompts
3. Players select one image from their set
4. Others guess which prompt created which image
5. Scoring based on successful deceptions and correct guesses

### Architecture
- **Backend**: Node.js/Express, Socket.IO, Redis, TypeScript
  - Location: `/prompt-guessr-backend`
  - Port: 3001
  - Real-time communication via Socket.IO
  - Redis for session storage
  
- **Frontend**: Next.js 14 (App Router), React 18, Socket.IO Client, TypeScript
  - Location: `/prompt-guessr-ui`
  - Port: 3000
  - Server components + client components pattern

### Key Data Structures
```
Room (Lobby)
  └── players: Map<playerId, Player>
  └── game?: Game (when playing)

Game
  └── leaderboard: { scores: Map<playerId, PlayerScore>, rankings: [] }
  └── rounds: Round[]
  └── status: 'prompt_submit' | 'image_generate' | ...

Round
  └── prompts: Map<playerId, PromptSubmission>
  └── selections: Map<playerId, ImageSelection>
  └── guesses: Map<imageId, Map<playerId, Guess>>
  └── scores: Map<playerId, number>
```

---

## Critical Technical Patterns

### Map Serialization (VERY IMPORTANT!)

**The Problem**: JavaScript Maps don't survive JSON serialization
```javascript
JSON.stringify(new Map([['a', 1]])) // Returns: "{}" ❌
```

**The Solution**: Serialize/Deserialize pattern

**Backend Flow**:
1. Business logic uses Maps (`.get()`, `.has()`, `.size`)
2. Before Redis storage: `serializeRoom(room)` → Maps to objects
3. After Redis retrieval: `deserializeRoom(data)` → objects to Maps
4. Before Socket.IO emit: `serializeGame(game)` → Maps to objects

**Frontend Flow**:
1. Receive socket data (plain objects)
2. Immediately: `deserializeGame(data)` → objects to Maps
3. Use Maps in components

**Files**:
- Backend: `/prompt-guessr-backend/src/storage/room-repository.ts` (serialize/deserialize functions)
- Backend: `/prompt-guessr-backend/src/socket/room-handlers.ts` (serializeRoom, serializeGame)
- Frontend: `/prompt-guessr-ui/src/lib/utils/room-utils.ts` (deserializeRoom)
- Frontend: `/prompt-guessr-ui/src/lib/utils/game-utils.ts` (deserializeGame)

**Why Maps at all?**
- Cleaner API: `map.get(id)` vs `obj[id]`
- Built-in size: `map.size` vs `Object.keys(obj).length`
- Better semantics in business logic
- Tradeoff: Adds serialization complexity but cleaner code

---

## Recent Work Completed

### ✅ Phase 1: Project Setup (Days 1-2)
- Split monorepo into `prompt-guessr-backend` and `prompt-guessr-ui`
- Fixed TypeScript configurations for both projects
- Set up Socket.IO communication
- Implemented room creation/joining flow
- Built lobby UI with ready-up system

### ✅ Phase 2: Prompt Submission Phase (Days 3-5)
**What we built:**
1. **Game Start Flow**
   - Host clicks "Start Game" → backend creates Game object
   - Game initialized with first Round in `prompt_submit` status
   - Leaderboard created with all players at 0 points
   - GAME_STARTED event broadcasts to all clients

2. **PromptSubmission Component** (`/prompt-guessr-ui/src/app/room/[code]/PromptSubmission.tsx`)
   - Text input with 200 char limit, 10 char minimum
   - Countdown timer (90s per player)
   - Real-time submission status for all players
   - Shows green checkmark when player submits
   - Grid display of all players with submit indicators

3. **Backend Prompt Handling** (`/prompt-guessr-backend/src/services/room-service.ts`)
   - `submitPrompt()` function stores prompt as PromptSubmission object
   - Detects when all players submitted (`prompts.size === players.size`)
   - Auto-transitions to `image_generate` phase
   - Returns `{ room, allSubmitted }` flag

4. **Phase Transition System**
   - New event: PHASE_TRANSITION
   - Backend broadcasts when all prompts submitted
   - Frontend receives and updates game state
   - Room page re-renders to next phase UI

5. **Socket Events Added**
   - `SUBMIT_PROMPT` (client → server): Player submits prompt
   - `PROMPT_SUBMITTED` (server → all): Notify player submitted
   - `PHASE_TRANSITION` (server → all): Game phase changed

6. **Conditional Rendering in Room Page**
   - Shows Lobby when `room.status === 'lobby'`
   - Shows PromptSubmission when `game.status === 'prompt_submit'`
   - Ready for future phase components (image generation, voting, etc.)

### ✅ Phase 3: Image Generation Phase (In Progress)
**What we built:**
1. **Mock Image Service** (`/prompt-guessr-backend/src/services/image-service.ts`)
   - Created `ImageProvider` interface for pluggable providers
   - Implemented `MockImageProvider` using picsum.photos placeholders
   - Returns 4 images per prompt with realistic delay (0.5-1.5s)
   - Singleton pattern with `getImageProvider()` and `setImageProvider()`
   - Ready to swap for real AI service (DALL-E, Stable Diffusion) later

2. **Image Generation Orchestration** (`/prompt-guessr-backend/src/services/room-service.ts`)
   - Added `generateImagesForRound()` function
   - Generates images in parallel for all submitted prompts
   - Updates prompt status: pending → generating → ready/failed
   - Auto-transitions from `image_generate` to `image_select` when complete
   - Handles failures gracefully (logs warning but continues)
   - Returns updated room with all generated images

3. **Socket Handler for Image Generation** (`/prompt-guessr-backend/src/socket/room-handlers.ts`)
   - Added `generateImagesInBackground()` async function
   - Triggers when all players submit prompts and phase transitions to `image_generate`
   - Runs image generation without blocking socket handler
   - Broadcasts PHASE_TRANSITION to `image_select` when images ready
   - Error handling with logging for failures

4. **ImageGeneration Component** (`/prompt-guessr-ui/src/app/room/[code]/ImageGeneration.tsx`)
   - Shows loading state during image generation phase
   - Displays progress bar tracking completed images
   - Animated loading placeholders (4-grid layout)
   - Shows status text ("Generating X images..." / "All images ready!")
   - Round counter at bottom

5. **Room Page Conditional Rendering** (`/prompt-guessr-ui/src/app/room/[code]/page.tsx`)
   - Added conditional rendering for `image_generate` phase
   - Shows Lobby when `room.status === 'lobby'`
   - Shows PromptSubmission when `game.status === 'prompt_submit'`
   - Shows ImageGeneration when `game.status === 'image_generate'`

6. **Lobby Component Extraction** (`/prompt-guessr-ui/src/app/room/[code]/Lobby.tsx`)
   - Extracted lobby UI into separate component
   - Props: room, roomCode, currentPlayer, isHost, onToggleReady, onStartGame
   - Handles player list display, ready status, and game start controls
   - Improved code organization and maintainability

### ✅ Phase 4: Image Selection Phase (Complete)
**What we built:**
1. **ImageSelection Component** (`/prompt-guessr-ui/src/app/room/[code]/ImageSelection.tsx`)
   - Shows player's 4 generated images in a grid
   - Click to select favorite image (visual feedback with ring/checkmark)
   - Confirm selection button
   - Waiting state after selection with progress bar
   - Displays prompt text for context

2. **Frontend Handler** (`/prompt-guessr-ui/src/hooks/useRoom.ts`)
   - Added `handleSelectImage()` function
   - Emits SELECT_IMAGE socket event
   - Optimistic update to local game state
   - Immediately shows waiting screen

3. **Backend Service** (`/prompt-guessr-backend/src/services/room-service.ts`)
   - Added `selectImage()` function
   - Stores ImageSelection in round.selections Map
   - Detects when all players selected (`selections.size === players.size`)
   - Auto-transitions to `reveal_guess` phase when complete

4. **Socket Handler** (`/prompt-guessr-backend/src/socket/room-handlers.ts`)
   - Added `handleSelectImage()` function
   - Validates player and room
   - Broadcasts PHASE_TRANSITION to `reveal_guess` when all selected
   - Error handling

5. **Event Definitions** (both frontend & backend `/shared/types/events.ts`)
   - Added `SelectImageEvent` interface
   - Added `SELECT_IMAGE` to SocketEvents constant

### ✅ Phase 5: Guessing/Reveal Phase (Complete)
**What we built:**
1. **RevealGuess Component** (`/prompt-guessr-ui/src/app/room/[code]/RevealGuess.tsx`)
   - Displays images one at a time for guessing
   - Shows current image with progress (Image X of Y)
   - Guess input field (disabled if it's your own image)
   - Waiting state after submitting guess
   - Progress bar showing how many players have guessed
   - Round counter display
   - Uses `currentRound.currentRevealIndex` from backend to show correct image

2. **Frontend Handler** (`/prompt-guessr-ui/src/hooks/useRoom.ts`)
   - Added `handleSubmitGuess()` function
   - Emits SUBMIT_GUESS socket event
   - Optimistic update to round.guesses Map
   - Creates nested Map structure (imageId → playerId → Guess)

3. **Component Wiring** (`/prompt-guessr-ui/src/app/room/[code]/page.tsx`)
   - Added RevealGuess import
   - Added conditional rendering for `game.status === 'reveal_guess'`
   - Passes handleSubmitGuess handler to component

4. **Backend Service** (`/prompt-guessr-backend/src/services/room-service.ts`)
   - Added `submitGuess()` function
   - Stores guess in round.guesses nested Map structure
   - Calculates expected guesses (total players - 1 if it's your own image)
   - Detects when all players guessed on current image
   - **Sequential reveal logic**: Advances `currentRevealIndex` to next image when all guessed
   - Transitions to `scoring` phase when all images revealed
   - Returns { room, allGuessed } flag

5. **Socket Handler** (`/prompt-guessr-backend/src/socket/room-handlers.ts`)
   - Added `handleSubmitGuess()` function
   - Validates room and player
   - Calls roomService.submitGuess()
   - Emits PHASE_TRANSITION when advancing to next image
   - Emits PHASE_TRANSITION to 'scoring' when all images revealed
   - Error handling with logging

6. **Event Definitions** (both frontend & backend `/shared/types/events.ts`)
   - Added `SubmitGuessEvent` interface (roomId, playerId, imageId, guessText)
   - Added `SUBMIT_GUESS: 'game:submit_guess'` to SocketEvents constant

7. **Round Type Updates** (both frontend & backend `/shared/types/round.ts`)
   - Added `currentRevealIndex: number` field to Round interface
   - Initialized to 0 when round created
   - Incremented by backend when all players guess on current image

### ✅ Phase 6: Scoring/Results Phase (Complete)
**What we built:**
1. **Scoring Service** (`/prompt-guessr-backend/src/services/scoring-service.ts`)
   - `calculateSimilarityScore()` - Baseline algorithm (keyword overlap + Levenshtein)
   - `calculatePoints()` - Award 100 pts for best guess, 50 pts for tricky prompts
   - Tokenization and string similarity utilities
   - Returns scores 0-100

2. **Backend Service** (`/prompt-guessr-backend/src/services/room-service.ts`)
   - Added `scoreRound()` function
   - Calculates similarity scores for all guesses
   - Awards points based on performance
   - Updates leaderboard with round scores and rankings
   - Marks round as completed
   - Transitions to `round_end` or `game_end`

3. **Socket Handler** (`/prompt-guessr-backend/src/socket/room-handlers.ts`)
   - Triggers `scoreRound()` when transitioning to scoring phase
   - Emits PHASE_TRANSITION to `round_end` or `game_end`
   - Includes serialized game with updated scores and leaderboard

4. **RoundResults Component** (`/prompt-guessr-ui/src/app/room/[code]/RoundResults.tsx`)
   - Shows round scores (points earned this round)
   - Displays full leaderboard with rankings
   - Medal animations for top 3 (🥇🥈🥉)
   - Different UI for round end vs game end
   - Shows per-round score breakdown

5. **Component Wiring** (`/prompt-guessr-ui/src/app/room/[code]/page.tsx`)
   - Added RoundResults import
   - Renders for both `round_end` and `game_end` statuses
   - Shows appropriate messaging based on game state

### 🔧 Major Problems Solved

#### Problem 1: Map Serialization Errors
**Error**: `prompts.has is not a function`, `scores.values is not a function`

**Root Cause**: Maps serialized to `{}` by Socket.IO, but frontend types still said Map

**Solution**: 
- Created `deserializeGame()` utility
- Applied in `useRoom` hook after receiving socket events
- Now Maps properly reconstructed on frontend

#### Problem 2: Backend Redis Deserialization
**Error**: `currentRound.prompts.set is not a function`

**Root Cause**: Redis stores JSON, retrieval gives plain objects, not Maps

**Solution**:
- Extended `room-repository.ts` deserialization to handle nested Game structure
- Added `deserializeGame()`, `deserializeRound()`, `deserializeLeaderboard()` helpers
- Now backend properly reconstructs Maps after Redis reads

#### Problem 3: TypeScript Tuple Destructuring Errors
**Error**: `Type 'unknown' is not assignable to type '[any, any]'`

**Root Cause**: TypeScript couldn't infer tuple types in `.map(([a, b]) => ...)` pattern

**Solution**:
- Extracted `serializeNestedGuesses()` helper function
- Used explicit typing: `(entry: any) => [entry[0], entry[1]]`
- Added clear comments explaining nested Map → array conversion

#### Problem 4: Unnecessary Type Assertions
**Warning**: SonarQube flagged redundant `as Map<string, Player>` casts

**Solution**: 
- Removed unnecessary assertions where return types already enforce correct type
- Kept only essential casts where type inference needs help

#### Problem 5: No UI Feedback After Prompt Submission
**Issue**: User submits prompt but UI doesn't change - still shows input form instead of "waiting" state

**Root Cause**: `PROMPT_SUBMITTED` event only logs to console, doesn't update local game state. So `currentRound.prompts.has(playerId)` stays false.

**Solution**: Optimistic update pattern in `handleSubmitPrompt`
- Immediately add submitted prompt to local `game.rounds[x].prompts` Map
- Call `setGame({ ...game })` to trigger re-render
- UI instantly switches to waiting screen
- Backend confirmation arrives later but state already updated
- File: `/prompt-guessr-ui/src/hooks/useRoom.ts`

#### Problem 6: Wrong Import Path in image-service.ts
**Error**: TypeScript couldn't resolve `../shared/types/prompt.js`

**Root Cause**: Types are in `shared/types/` at project root, not inside `src/` folder

**Solution**: 
- Fixed import path to `../../shared/types/prompt.js`
- Correct path goes up two levels: `src/services/` → `src/` → project root → `shared/types/`

#### Problem 7: SonarQube Nested Ternary Warning
**Warning**: `Extract this nested ternary operation into an independent statement`

**Root Cause**: Nested ternary in page.tsx made phase rendering hard to read and maintain

**Solution**:
- Extracted rendering logic into `renderGamePhase()` helper function
- Used clear if/else statements instead of nested ternaries
- Created separate Lobby component for better separation of concerns
- Now each phase (lobby, prompt_submit, image_generate) has its own component
- Files: `/prompt-guessr-ui/src/app/room/[code]/page.tsx`, `/prompt-guessr-ui/src/app/room/[code]/Lobby.tsx`

### ✅ Phase 7: Reveal Phase (Complete)
**What we built:**
1. **GuessReveal Component** (`/prompt-guessr-ui/src/app/room/[code]/GuessReveal.tsx`)
   - Shows each image with its original prompt
   - Lists all players' guesses ranked by similarity score
   - Visual feedback: medals for top 3 (🥇🥈🥉)
   - Color-coded scores: green (80+), yellow (60+), orange (40+), red (<40)
   - Progress bars showing similarity percentage
   - Sequential reveal: one image at a time
   - "Next Image" button advances through images
   - "See Results" button on last image triggers phase transition

2. **Scoring Updates** (`/prompt-guessr-backend/src/services/room-service.ts`)
   - Updated `scoreRound()` to store similarity scores in Guess objects
   - Each guess.score field populated with calculated 0-100 score
   - Transition to `reveal_results` phase instead of `round_end`
   - Added `completeReveal()` function:
     - Marks round as completed
     - Transitions to `round_end` or `game_end` based on remaining rounds
     - Called when player clicks through all reveals

3. **New Game Status** (both frontend & backend `/shared/types/round.ts`)
   - Added `'reveal_results'` to RoundStatus type
   - Flow: scoring → reveal_results → round_end/game_end
   - Allows players to see how scores were calculated

4. **Socket Events** (both frontend & backend `/shared/types/events.ts`)
   - Added `CompleteRevealEvent` interface (roomId, playerId)
   - Added `COMPLETE_REVEAL: 'game:complete_reveal'` to SocketEvents constant

5. **Socket Handler** (`/prompt-guessr-backend/src/socket/room-handlers.ts`)
   - Added `handleCompleteReveal()` function
   - Validates room and player
   - Calls `roomService.completeReveal()`
   - Broadcasts PHASE_TRANSITION to round_end or game_end
   - Error handling with logging

6. **Frontend Integration** (`/prompt-guessr-ui/src/hooks/useRoom.ts`)
   - Added `handleCompleteReveal()` function to hook
   - Emits COMPLETE_REVEAL socket event
   - Added to UseRoomReturn interface
   
7. **Page Integration** (`/prompt-guessr-ui/src/app/room/[code]/page.tsx`)
   - Added GuessReveal import
   - Added reveal_results rendering case (before round_end/game_end)
   - Passes handleCompleteReveal handler to GuessReveal component

---

## Current State

### What's Working ✅
- Room creation and joining
- Player ready-up system
- Game start with proper initialization
- Prompt submission UI fully functional
- Real-time updates when players submit
- Automatic phase transition when all players submit
- Map serialization/deserialization throughout stack
- Mock image generation service (placeholder images)
- Image generation orchestration (parallel generation for all prompts)
- Background image generation trigger (auto-fires when prompts complete)
- Image generation loading UI with progress tracking
- Image selection UI (4-grid with selection feedback)
- Image selection phase complete (transitions to reveal_guess)
- RevealGuess component with sequential reveal
- Backend guess handling with automatic image advancement
- Transitions to scoring phase when all images revealed
- Scoring algorithm (keyword overlap + Levenshtein similarity)
- Points calculation and leaderboard updates
- Round results display with rankings and scores
- Guess reveal phase showing prompts and scored guesses
- Visual similarity feedback with color-coded scores and progress bars
- Sequential reveal through all images with rankings

### What's NOT Built Yet ❌
- Next round transition (start Round 2 after Round 1 ends)
- Timer enforcement (prompts accepted after timer expires)
- Reconnection handling for disconnected players

### Known Technical Debt
- No timer enforcement on backend (trusts client timers)
- No validation of prompt content (profanity, length edge cases)
- Error handling could be more robust
- No reconnection handling for disconnected players
- No tests yet

---

## Next Steps (Priority Order)

### 1. Image Generation Phase (Complete)
**Goal**: Generate 4 images for each submitted prompt

**Implementation Plan**:
- ✅ Create mock image generation service first (random placeholder images)
- ✅ Add `generateImages()` function to room-service
- ✅ Transition from `image_generate` to `image_select` when all images ready
- ✅ Create ImageGeneration component (loading state while generating)
- Later: Integrate real AI service (DALL-E 3, Stable Diffusion, etc.)

**Files to Create/Modify**:
- Backend: ✅ `src/services/image-service.ts` (created - mock provider)
- Backend: ✅ `src/services/room-service.ts` (added generateImagesForRound function)
- Backend: ✅ `src/socket/room-handlers.ts` (add handler to trigger generation on phase change)
- Frontend: ✅ `src/app/room/[code]/ImageGeneration.tsx` (new component)
- Frontend: ✅ `src/app/room/[code]/page.tsx` (add conditional rendering)

### 2. Image Selection Phase
- Players choose 1 image from their 4 generated images
- Submit selection to backend
- When all selected → transition to guessing phase

### 3. Guessing Phase
- Show all selected images (shuffled, anonymous)
- Players guess which prompt matches which image
- Timer for guessing

### 4. Scoring & Reveal Phase
- Calculate scores (points for fooling others, points for correct guesses)
- Show reveal animation
- Update leaderboard
- Show round results

### 5. Round Management
- Handle multiple rounds (default: 3 rounds)
- Track scores across rounds
- Final leaderboard at end

### 6. Polish & Production
- Real AI image generation
- Error handling improvements
- Reconnection logic
- Testing
- Deployment

---

## File Structure Reference

### Backend Key Files
```
prompt-guessr-backend/
├── src/
│   ├── socket/
│   │   └── room-handlers.ts          # Socket event handlers, serialization
│   ├── services/
│   │   └── room-service.ts           # Business logic (createRoom, joinRoom, startGame, submitPrompt)
│   ├── storage/
│   │   └── room-repository.ts        # Redis operations, serialization/deserialization
│   └── shared/types/
│       ├── room.ts                   # Room, Player interfaces
│       ├── game.ts                   # Game, Leaderboard interfaces
│       ├── round.ts                  # Round, RoundStatus
│       ├── prompt.ts                 # PromptSubmission, GeneratedImage
│       └── events.ts                 # Socket event interfaces
```

### Frontend Key Files
```
prompt-guessr-ui/
├── src/
│   ├── app/room/[code]/
│   │   ├── page.tsx                  # Main room page, conditional rendering
│   │   └── PromptSubmission.tsx      # Prompt submission UI
│   ├── hooks/
│   │   └── useRoom.ts                # Socket connection, event handlers
│   ├── lib/
│   │   ├── socket-client.ts          # Socket.IO client setup
│   │   └── utils/
│   │       ├── room-utils.ts         # deserializeRoom
│   │       └── game-utils.ts         # deserializeGame
│   └── shared/types/                 # Same types as backend
```

---

## Common Patterns to Follow

### Adding a New Socket Event
1. Define event interfaces in `shared/types/events.ts` (both backend & frontend)
2. Add event name to `SocketEvents` constant
3. Backend: Add handler in `room-handlers.ts`, call service function
4. Backend: Emit response with serialized data if needed
5. Frontend: Add listener in `useRoom.ts`
6. Frontend: Call `deserializeGame()` if receiving game data

### Adding a New Game Phase
1. Update `RoundStatus` union type in `shared/types/round.ts`
2. Create component in `src/app/room/[code]/[PhaseName].tsx`
3. Add conditional rendering in `page.tsx`
4. Add backend service function for phase logic
5. Add socket events for player actions
6. Add transition logic (detect completion → change status → emit PHASE_TRANSITION)

### Working with Maps
- **Backend**: Always use Map methods in business logic
- **Before storage/transmission**: Call serialize functions
- **After retrieval/reception**: Call deserialize functions
- **Frontend components**: Always work with Maps (after deserialization)

---

## Testing Checklist (Manual)

### Prompt Submission Phase
- [ ] 2 players join room
- [ ] Both ready up
- [ ] Host starts game
- [ ] Both see PromptSubmission component
- [ ] Timer counts down
- [ ] Player 1 submits prompt → sees green checkmark
- [ ] Player 2 sees Player 1's status update
- [ ] Player 2 submits prompt
- [ ] Both players see PHASE_TRANSITION
- [ ] Game status changes to `image_generate`

---

## Questions to Ask User If Stuck

### About Requirements
- "What should happen when [scenario]?"
- "How should we handle [edge case]?"
- "Should we implement [feature] now or later?"

### About Errors
- "Can you share the full error message?"
- "Which file is showing the error?"
- "When does this error occur - what action triggers it?"

### Before Major Changes
- "Should I [proposed action], or would you prefer [alternative]?"
- "This will require changes to [X] files. Should I proceed?"

---

## Remember
- User is learning - explain the "why" not just the "what"
- One file at a time, confirm before editing
- Check for linting issues after edits
- Keep code readable over clever
- This is a learning project, not production (be pragmatic, not perfect)

---

**Last Updated**: December 27, 2025 - 21:15
**Current Phase**: Reveal Phase (Complete) → Next: Round transitions
**Session State**: Full gameplay loop working end-to-end with reveal phase showing scored guesses
