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
 * Follows the "First Player Red" rule.
 */
export function autoAssignToTeam(playerId: number): boolean {
    const TEAM_SIZE_LIMIT = 3;
    const playerList = room.getPlayerList();
    const redCount = playerList.filter(p => p.team === 1).length;
    const blueCount = playerList.filter(p => p.team === 2).length;

    // Rule 1: First player enters -> Red team
    if (playerList.length === 1) {
        movePlayerToTeam(playerId, redPlayerIdList);
        return true;
    }

    // Rule 2: Balance teams (up to 3x3)
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

/**
 * Checks if teams are balanced (1v1, 2v2, 3v3) and starts the game if not running.
 */
export function checkAutoStart(): void {
    const scores = room.getScores();
    if (scores !== null) return; // Game already running

    const redCount = room.getPlayerList().filter(p => p.team === 1).length;
    const blueCount = room.getPlayerList().filter(p => p.team === 2).length;

    // Start if teams are balanced and have at least 1 player each
    if (redCount > 0 && redCount === blueCount) {
        room.startGame();
    }
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
