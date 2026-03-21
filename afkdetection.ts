import { room } from "./index.js";

const lastPlayerActivityTimestamp = new Map<number, number>();
const lastPlayerPosition = new Map<number, { x: number, y: number }>();
const gracePeriodExpiry = new Map<number, number>();
const hasPlayerBeenWarnedToMove = new Set<number>();
const afkPlayers = new Set<number>();
const pickTimeoutExpiry = new Map<number, number>();

export function setLastPlayerActivityTimestamp(playerId: number) {
    lastPlayerActivityTimestamp.set(playerId, Date.now());
}

/**
 * Sets a 10-second timer for a player before they can be picked.
 * Called when a player joins, goes AFK, or moves to spectators.
 */
export function setPickTimeout(playerId: number) {
    pickTimeoutExpiry.set(playerId, Date.now() + 10000);
}

/**
 * Checks if a player's pick timeout has expired.
 */
export function isPickTimeoutActive(playerId: number): boolean {
    const expiry = pickTimeoutExpiry.get(playerId) || 0;
    return Date.now() < expiry;
}

/**
 * Gets remaining pick timeout in seconds.
 */
export function getRemainingPickTimeout(playerId: number): number {
    const expiry = pickTimeoutExpiry.get(playerId) || 0;
    return Math.ceil((expiry - Date.now()) / 1000);
}

/**
 * Sets a grace period for a player during which they won't be kicked for AFK.
 * @param playerId The ID of the player.
 * @param durationMs The duration of the grace period in milliseconds (default 45s).
 */
export function setGracePeriod(playerId: number, durationMs: number = 45000) {
    gracePeriodExpiry.set(playerId, Date.now() + durationMs);
    setLastPlayerActivityTimestamp(playerId);
}

export function handlePlayerActivity(playerId: number) {
    const player = room.getPlayer(playerId);
    // Only track activity for players in a team (Red/Blue)
    if (player && player.team !== 0) {
        setLastPlayerActivityTimestamp(playerId);
        hasPlayerBeenWarnedToMove.delete(playerId);
    }
}

export function setPlayerAfk(playerId: number): void {
    afkPlayers.add(playerId);
    setPickTimeout(playerId); // Also set pick timeout when going AFK
}

export function removePlayerAfk(playerId: number): void {
    afkPlayers.delete(playerId);
    setPickTimeout(playerId); // Set pick timeout when returning from AFK
}

export function isPlayerAfk(playerId: number): boolean {
    return afkPlayers.has(playerId);
}

export function getAfkPlayerIds(): number[] {
    return [...afkPlayers];
}

export function getAfkPlayerNames(): string[] {
    return getAfkPlayerIds()
        .map((id) => room.getPlayer(id))
        .filter((p): p is PlayerObject => p !== null && p !== undefined)
        .map((p) => p.name);
}

export function checkAndHandleInactivePlayers() {
    const now = Date.now();
    const scores = room.getScores();
    
    // Only perform AFK checks if a game is active
    if (!scores) return;

    for (let [playerId, timestamp] of lastPlayerActivityTimestamp.entries()) {
        const player = room.getPlayer(playerId);
        
        // Safety checks: player must exist, be in a team, and NOT be in a grace period
        if (!player || player.team === 0) {
            lastPlayerActivityTimestamp.delete(playerId);
            lastPlayerPosition.delete(playerId);
            gracePeriodExpiry.delete(playerId);
            continue;
        }

        const expiry = gracePeriodExpiry.get(playerId) || 0;
        if (now < expiry) continue; // Still in grace period

        // Track movement
        const currentPos = player.position;
        if (currentPos) {
            const lastPos = lastPlayerPosition.get(playerId);
            if (lastPos && (lastPos.x !== currentPos.x || lastPos.y !== currentPos.y)) {
                // Player moved, reset timestamp
                setLastPlayerActivityTimestamp(playerId);
                lastPlayerPosition.set(playerId, { x: currentPos.x, y: currentPos.y });
                hasPlayerBeenWarnedToMove.delete(playerId);
                continue;
            }
            lastPlayerPosition.set(playerId, { x: currentPos.x, y: currentPos.y });
        }

        if (now - timestamp >= 10000 && !hasPlayerBeenWarnedToMove.has(playerId)) {
            room.sendAnnouncement(`❗️ ${player.name}, move or you will be kicked from the match!`, playerId, 0xFF0000, "bold", 2);
            hasPlayerBeenWarnedToMove.add(playerId);
        }
        
        if (now - timestamp >= 15000) {
            room.sendAnnouncement(`❌ ${player.name} was kicked for being AFK`, undefined, 0xFF0000, "bold");
            room.kickPlayer(playerId, "AFK in match", false);
        }
    }
}

export function removePlayerFromAfkMapsAndSets(playerId: number): void {
    lastPlayerActivityTimestamp.delete(playerId);
    lastPlayerPosition.delete(playerId);
    gracePeriodExpiry.delete(playerId);
    hasPlayerBeenWarnedToMove.delete(playerId);
    pickTimeoutExpiry.delete(playerId);
}

/**
 * Resets all activity timers for all team players, typically called at game start.
 */
export function resetAllActivityTimestamps(): void {
    lastPlayerActivityTimestamp.clear();
    lastPlayerPosition.clear();
    hasPlayerBeenWarnedToMove.clear();
    
    // Set a 30s grace period for all players currently in teams
    const teamPlayers = room.getPlayerList().filter(p => p.team !== 0);
    for (const p of teamPlayers) {
        setGracePeriod(p.id, 30000);
        if (p.position) {
            lastPlayerPosition.set(p.id, { x: p.position.x, y: p.position.y });
        }
    }
}
