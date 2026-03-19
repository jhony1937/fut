import { room } from "./index.js";

const lastPlayerActivityTimestamp = new Map<number, number>();
const gracePeriodExpiry = new Map<number, number>();
const hasPlayerBeenWarnedToMove = new Set<number>();
const afkPlayers = new Set<number>();

export function setLastPlayerActivityTimestamp(playerId: number) {
    lastPlayerActivityTimestamp.set(playerId, Date.now());
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
}

export function removePlayerAfk(playerId: number): void {
    afkPlayers.delete(playerId);
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
            gracePeriodExpiry.delete(playerId);
            continue;
        }

        const expiry = gracePeriodExpiry.get(playerId) || 0;
        if (now < expiry) continue; // Still in grace period

        if (now - timestamp >= 10000 && !hasPlayerBeenWarnedToMove.has(playerId)) {
            room.sendAnnouncement(`❗️ ${player.name}, move or you will be kicked from the match!`, playerId, 0xFF0000, "bold", 2);
            hasPlayerBeenWarnedToMove.add(playerId);
        }
        
        if (now - timestamp >= 15000) {
            room.kickPlayer(playerId, "AFK in match", false);
        }
    }
}

export function removePlayerFromAfkMapsAndSets(playerId: number): void {
    lastPlayerActivityTimestamp.delete(playerId);
    gracePeriodExpiry.delete(playerId);
    hasPlayerBeenWarnedToMove.delete(playerId);
}

/**
 * Resets all activity timers for all team players, typically called at game start.
 */
export function resetAllActivityTimestamps(): void {
    const now = Date.now();
    lastPlayerActivityTimestamp.clear();
    hasPlayerBeenWarnedToMove.clear();
    
    // Set a 30s grace period for all players currently in teams
    const teamPlayers = room.getPlayerList().filter(p => p.team !== 0);
    for (const p of teamPlayers) {
        setGracePeriod(p.id, 30000);
    }
}
