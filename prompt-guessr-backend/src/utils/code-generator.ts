/**
 * Character set for room codes.
 * Excludes confusing characters: I, O, 0, 1
 * Uses uppercase letters and numbers for clarity.
 */
const CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a random room code.
 * 
 * @param length - Length of the code (default: 4)
 * @returns A random uppercase alphanumeric code
 * 
 * @example
 * generateRoomCode() // "ABCD"
 * generateRoomCode(6) // "XYZ789"
 */
export function generateRoomCode(length: number = 4): string {
  let code = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * CHARACTERS.length);
    code += CHARACTERS[randomIndex];
  }
  
  return code;
}

/**
 * Validate if a string is a valid room code format.
 * 
 * @param code - The code to validate
 * @returns True if the code matches our format
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  // Must be uppercase alphanumeric from our character set
  const regex = new RegExp(`^[${CHARACTERS}]+$`);
  return regex.test(code) && code.length >= 4 && code.length <= 8;
}
