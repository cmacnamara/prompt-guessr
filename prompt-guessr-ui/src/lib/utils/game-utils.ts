import { Game, Round, Leaderboard, Guess } from '@/shared/types';

/**
 * Converts a plain game object from the server into a Game type
 * with all nested Maps properly reconstructed
 */
export function deserializeGame(gameData: any): Game {
  if (!gameData) return gameData;

  return {
    ...gameData,
    leaderboard: deserializeLeaderboard(gameData.leaderboard),
    rounds: gameData.rounds?.map(deserializeRound) || [],
  };
}

/**
 * Converts a plain leaderboard object into a Leaderboard type
 * with the scores Map reconstructed
 */
function deserializeLeaderboard(leaderboardData: any): Leaderboard {
  if (!leaderboardData) return leaderboardData;

  return {
    scores: new Map(Object.entries(leaderboardData.scores)),
    rankings: leaderboardData.rankings || [],
  };
}

/**
 * Converts a plain round object into a Round type
 * with all Maps (prompts, selections, guesses, scores) reconstructed
 */
function deserializeRound(roundData: any): Round {
  if (!roundData) return roundData;

  return {
    ...roundData,
    prompts: new Map(Object.entries(roundData.prompts || {})),
    selections: new Map(Object.entries(roundData.selections || {})),
    guesses: deserializeGuesses(roundData.guesses || []),
    bonusPoints: new Map(Object.entries(roundData.bonusPoints || {})),
    scores: new Map(Object.entries(roundData.scores || {})),
  };
}

/**
 * Converts nested guesses array back to Map<string, Map<string, Guess>>
 * The backend serializes this as: [[imageId, {...guessMap}], ...]
 */
function deserializeGuesses(guessesData: any): Map<string, Map<string, Guess>> {
  if (!guessesData || !Array.isArray(guessesData)) {
    return new Map();
  }

  return new Map(
    guessesData.map(([imageId, guessMap]: [string, any]) => [
      imageId,
      new Map(Object.entries(guessMap || {}))
    ])
  );
}
