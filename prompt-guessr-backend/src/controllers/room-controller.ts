import { Request, Response } from 'express';
import * as roomService from '../services/room-service';
import { getRoomByCode as getRoomByCodeRepo } from '../storage/room-repository';
import { logger } from '../utils/logger';

/**
 * Get room by code.
 * GET /api/rooms/:code
 */
export async function getRoomByCode(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Room code is required' });
      return;
    }

    const room = await getRoomByCodeRepo(code.toUpperCase());

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Serialize the room (convert Map to object for JSON)
    const serializedRoom = {
      ...room,
      players: Object.fromEntries(room.players),
    };

    res.json({ room: serializedRoom });
  } catch (error) {
    logger.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
}

/**
 * Create a new room.
 * POST /api/rooms/create
 */
export async function createRoom(req: Request, res: Response): Promise<void> {
  try {
    const { playerName, settings } = req.body;

    if (!playerName || typeof playerName !== 'string') {
      res.status(400).json({ error: 'Player name is required' });
      return;
    }

    // Use a temporary session ID (will be replaced when socket connects)
    const sessionId = 'temp-' + Date.now();
    
    const { room, playerId } = await roomService.createRoom(
      playerName,
      sessionId,
      settings
    );

    logger.info(`Room created via REST: ${room.code}`);

    res.json({
      roomId: room.id,
      roomCode: room.code,
      playerId,
    });
  } catch (error) {
    logger.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
}

/**
 * Join an existing room.
 * POST /api/rooms/join
 */
export async function joinRoom(req: Request, res: Response): Promise<void> {
  try {
    const { roomCode, playerName } = req.body;

    if (!roomCode || typeof roomCode !== 'string') {
      res.status(400).json({ error: 'Room code is required' });
      return;
    }

    if (!playerName || typeof playerName !== 'string') {
      res.status(400).json({ error: 'Player name is required' });
      return;
    }

    // Use a temporary session ID (will be replaced when socket connects)
    const sessionId = 'temp-' + Date.now();

    const { room, playerId } = await roomService.joinRoom(
      roomCode,
      playerName,
      sessionId
    );

    logger.info(`Player joined room via REST: ${room.code}`);

    res.json({
      roomId: room.id,
      roomCode: room.code,
      playerId,
    });
  } catch (error: any) {
    logger.error('Error joining room:', error);
    res.status(400).json({ error: error.message || 'Failed to join room' });
  }
}
