import { room, specPlayerIdList } from "./index.js";

const lastPlayerActivityTimestamp = new Map<number, number>();
const hasPlayerBeenWarnedToMove = new Set<number>();
const afkPlayers = new Set<number>();

export function setLastPlayerActivityTimestamp(playerId: number) {
    lastPlayerActivityTimestamp.set(playerId, Date.now());
}

export function handlePlayerActivity(playerId: number) {
    if (!specPlayerIdList.includes(playerId)) {
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
    for (let [playerId, timestamp] of lastPlayerActivityTimestamp.entries()) {
        const player = room.getPlayer(playerId);
        if (!player) continue;
        if (Date.now() - timestamp >= 5000 && !hasPlayerBeenWarnedToMove.has(playerId)) {
            room.sendAnnouncement(`❗️ ${player.name}, move or you will be kicked!`, playerId, 0xFF0000, "bold", 2);
            hasPlayerBeenWarnedToMove.add(playerId);
        }
        if (Date.now() - timestamp >= 10000) room.kickPlayer(playerId, "AFK", false);
    }
}

export function removePlayerFromAfkMapsAndSets(playerId: number): void {
    lastPlayerActivityTimestamp.delete(playerId);
    hasPlayerBeenWarnedToMove.delete(playerId);
}
