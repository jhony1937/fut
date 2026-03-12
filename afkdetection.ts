import { room, specPlayerIdList } from "./index.js";

const lastPlayerActivityTimestamp = new Map<number, number>();
const hasPlayerBeenWarnedToMove = new Set<number>();

export function setLastPlayerActivityTimestamp(playerId: number) {
    lastPlayerActivityTimestamp.set(playerId, Date.now());
}

export function handlePlayerActivity(playerId: number) {
    if (!specPlayerIdList.includes(playerId)) {
        setLastPlayerActivityTimestamp(playerId);
        hasPlayerBeenWarnedToMove.delete(playerId);
    }
}

export function checkAndHandleInactivePlayers() {
    for (let [playerId, timestamp] of lastPlayerActivityTimestamp.entries()) {
        if (Date.now() - timestamp >= 5000 && !hasPlayerBeenWarnedToMove.has(playerId)) {
            room.sendAnnouncement(`❗️ ${room.getPlayer(playerId).name}, move-te ou serás expulso!`, playerId, 0xFF0000, "bold", 2);
            hasPlayerBeenWarnedToMove.add(playerId);
        }
        if (Date.now() - timestamp >= 10000) room.kickPlayer(playerId, "AFK", false);
    }
}

export function removePlayerFromAfkMapsAndSets(playerId: number): void {
    lastPlayerActivityTimestamp.delete(playerId);
    hasPlayerBeenWarnedToMove.delete(playerId)
}
