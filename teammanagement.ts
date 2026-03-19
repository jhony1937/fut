import { removePlayerFromAfkMapsAndSets } from "./afkdetection.js";
import { bluePlayerIdList, redPlayerIdList, room } from "./index.js";
import { getNextSpectator, getFullQueueList } from "./spectatorQueue.js";
import { displaySpectators, setPickingState } from "./autopick.js";

export function movePlayerToTeam(playerId: number, teamPlayerIdList: number[]) {
    const teamId: number = teamPlayerIdList === redPlayerIdList ? 1 : 2;
    room.setPlayerTeam(playerId, teamId);
}

/**
 * Automatically assigns a player to the team with fewer players if there is space.
 */
export function autoAssignToTeam(playerId: number): boolean {
    const TEAM_SIZE_LIMIT = 3;
    const redCount = room.getPlayerList().filter(p => p.team === 1).length;
    const blueCount = room.getPlayerList().filter(p => p.team === 2).length;

    if (redCount < TEAM_SIZE_LIMIT || blueCount < TEAM_SIZE_LIMIT) {
        if (redCount < blueCount) {
            movePlayerToTeam(playerId, redPlayerIdList);
        } else if (blueCount < redCount) {
            movePlayerToTeam(playerId, bluePlayerIdList);
        } else {
            // Equal: assign randomly
            const teamToJoin = Math.random() < 0.5 ? redPlayerIdList : bluePlayerIdList;
            movePlayerToTeam(playerId, teamToJoin);
        }
        return true;
    }
    return false;
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

    // Move the FIRST available spectator to the losing team automatically
    const nextSpec = getNextSpectator();
    if (nextSpec) {
        room.sendAnnouncement(`📢 Auto-pick: ${nextSpec.name} moved to the losing team.`, undefined, 0x00FF00, "bold", 0);
        movePlayerToTeam(nextSpec.id, losingTeamIdList);
    } else {
        const fullQueue = getFullQueueList();
        if (fullQueue.length > 0) {
            room.sendAnnouncement("📢 No available players (all AFK)", undefined, 0xFF0000, "bold", 0);
        } else {
            room.sendAnnouncement("📢 No spectators waiting for auto-pick.", undefined, 0xFFFF00, "bold", 0);
        }
    }

    // Enable picking phase and display list
    setPickingState(true);
    displaySpectators();
}
