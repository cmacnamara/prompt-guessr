import { Router } from 'express';
import * as roomController from '../controllers/room-controller';

/**
 * Room routes.
 * All routes are prefixed with /api/rooms when mounted.
 */
const router = Router();

/**
 * GET /api/rooms/:code
 * Get room by code
 */
router.get('/:code', roomController.getRoomByCode);

/**
 * POST /api/rooms/create
 * Create a new room
 */
router.post('/create', roomController.createRoom);

/**
 * POST /api/rooms/join
 * Join an existing room
 */
router.post('/join', roomController.joinRoom);

export default router;
