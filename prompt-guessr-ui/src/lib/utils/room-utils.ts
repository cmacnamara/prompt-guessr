import { Room } from '@/shared/types';

/**
 * Converts a plain room object from the server into a Room type
 * with the players Map properly reconstructed
 */
export function deserializeRoom(roomData: any): Room {
  return {
    ...roomData,
    players: new Map(Object.entries(roomData.players)),
  };
}
