import { logger } from '../utils/logger';

/**
 * Calculate similarity score between original prompt and guess.
 * Uses simple keyword overlap + fuzzy string matching.
 * Returns score 0-100.
 */
export function calculateSimilarityScore(
  originalPrompt: string,
  guess: string
): number {
  const original = originalPrompt.toLowerCase().trim();
  const guessText = guess.toLowerCase().trim();

  // Exact match = 100
  if (original === guessText) {
    return 100;
  }

  // Tokenize (split on whitespace and punctuation)
  const originalTokens = tokenize(original);
  const guessTokens = tokenize(guessText);

  // Calculate keyword overlap (Jaccard similarity)
  const intersection = originalTokens.filter(t => guessTokens.includes(t));
  const union = new Set([...originalTokens, ...guessTokens]);
  const keywordSimilarity = union.size > 0 ? intersection.length / union.size : 0;

  // Calculate string similarity (Levenshtein-based)
  const stringSimilarity = levenshteinSimilarity(original, guessText);

  // Weighted combination: 60% keyword, 40% string similarity
  const finalScore = Math.round((keywordSimilarity * 0.6 + stringSimilarity * 0.4) * 100);

  return Math.max(0, Math.min(100, finalScore)); // Clamp to 0-100
}

/**
 * Tokenize text into words (remove punctuation, split on whitespace).
 */
function tokenize(text: string): string[] {
  return text
    .replaceAll(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/) // Split on whitespace
    .filter(token => token.length > 0); // Remove empty strings
}

/**
 * Calculate Levenshtein similarity (0-1 scale).
 * Returns 1 - (distance / maxLength)
 */
function levenshteinSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  
  if (maxLength === 0) return 1;
  
  return 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings.
 * Returns the minimum number of edits (insert, delete, substitute) needed.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array
  const matrix: number[][] = new Array(len1 + 1)
    .fill(null)
    .map(() => new Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Award points based on similarity scores:
 * - Each player earns points equal to their similarity score (0-100)
 * - Image creator gets bonus points if their prompt was tricky (avg score < 40)
 */
export function calculatePoints(
  scores: Array<{ playerId: string; score: number }>,
  imageCreatorId: string
): Map<string, number> {
  const points = new Map<string, number>();

  if (scores.length === 0) {
    return points;
  }

  // Award points to each guesser based on their similarity score
  for (const { playerId, score } of scores) {
    points.set(playerId, Math.round(score));
    logger.info(`Awarding ${Math.round(score)} points to ${playerId} for guess (similarity: ${score})`);
  }

  // Award bonus points to image creator if prompt was tricky (average score < 40)
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  if (avgScore < 40) {
    const existingPoints = points.get(imageCreatorId) || 0;
    points.set(imageCreatorId, existingPoints + 50);
    logger.info(`Awarding 50 bonus points to ${imageCreatorId} for tricky prompt (avg score: ${avgScore})`);
  }

  return points;
}
