import { room } from "./index.js";

/**
 * Ordered list of spectator player IDs (FIFO)
 */
let spectatorQueue: number[] = [];

/**
 * Adds a player to the end of the spectator queue
 */
export function addToQueue(playerId: number): void {
    if (!spectatorQueue.includes(playerId)) {
        spectatorQueue.push(playerId);
        console.log(`[Queue] Player ${playerId} added to queue. Current queue: ${spectatorQueue}`);
    }
}

/**
 * Removes a player from the spectator queue
 */
export function removeFromQueue(playerId: number): void {
    const index = spectatorQueue.indexOf(playerId);
    if (index !== -1) {
        spectatorQueue.splice(index, 1);
        console.log(`[Queue] Player ${playerId} removed from queue. Current queue: ${spectatorQueue}`);
    }
}

/**
 * Returns the current ordered list of spectators (PlayerObject[])
 */
export function getQueueList(): PlayerObject[] {
    return spectatorQueue
        .map(id => room.getPlayer(id))
        .filter((p): p is PlayerObject => p !== null && p.team === 0);
}

/**
 * Gets the first spectator in the queue (FIFO)
 */
export function getNextSpectator(): PlayerObject | null {
    const list = getQueueList();
    return list.length > 0 ? list[0] : null;
}

/**
 * Selects a player from the queue by their displayed index (1-based)
 */
export function getSpectatorByIndex(index: number): PlayerObject | null {
    const list = getQueueList();
    if (index > 0 && index <= list.length) {
        return list[index - 1];
    }
    return null;
}

/**
 * Clears the queue (useful for resets)
 */
export function clearQueue(): void {
    spectatorQueue = [];
}
