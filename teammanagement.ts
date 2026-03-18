import { removePlayerFromAfkMapsAndSets, setLastPlayerActivityTimestamp } from "./afkdetection.js";
import { bluePlayerIdList, redPlayerIdList, room } from "./index.js";
import { getNextSpectator } from "./spectatorQueue.js";

export function movePlayerToTeam(playerId: number, teamPlayerIdList: number[]) {
    const teamId: number = teamPlayerIdList === redPlayerIdList ? 1 : 2;
    room.setPlayerTeam(playerId, teamId);
    setLastPlayerActivityTimestamp(playerId);
}

function movePlayerToSpec(playerId: number) {
    room.setPlayerTeam(playerId, 0);
    removePlayerFromAfkMapsAndSets(playerId);
}

export function moveOneSpecToEachTeam(): void {
    const nextSpec1 = getNextSpectator();
    if (nextSpec1) movePlayerToTeam(nextSpec1.id, redPlayerIdList);
    const nextSpec2 = getNextSpectator();
    if (nextSpec2) movePlayerToTeam(nextSpec2.id, bluePlayerIdList);
}

export function moveLastOppositeTeamMemberToSpec(oppositeTeamPlayerIdList: number[]): void {
    movePlayerToSpec(oppositeTeamPlayerIdList[oppositeTeamPlayerIdList.length - 1]!);
}

/**
 * Handles team win logic: 
 * - Winners stay.
 * - Losers go to spec.
 * - Top spectator moves to the losing team automatically.
 */
export function handleTeamWin(winningTeamIdList: number[]) {
    const losingTeamIdList = winningTeamIdList === redPlayerIdList ? bluePlayerIdList : redPlayerIdList;
    
    // Move all losers to spec
    while (losingTeamIdList.length > 0) {
        movePlayerToSpec(losingTeamIdList[0]!);
    }

    // Move the FIRST spectator to the losing team automatically
    const nextSpec = getNextSpectator();
    if (nextSpec) {
        room.sendAnnouncement(`📢 Auto-pick: ${nextSpec.name} moved to the losing team.`, undefined, 0x00FF00, "bold", 0);
        movePlayerToTeam(nextSpec.id, losingTeamIdList);
    } else {
        room.sendAnnouncement("📢 No spectators waiting for auto-pick.", undefined, 0xFFFF00, "bold", 0);
    }
}
