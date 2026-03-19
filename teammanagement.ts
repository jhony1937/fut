import { removePlayerFromAfkMapsAndSets } from "./afkdetection.js";
import { room } from "./index.js";
import { getNextSpectator, getFullQueueList } from "./spectatorQueue.js";
import { displaySpectators, setPickingState } from "./autopick.js";

/**
 * Moves a player to a specific team (1 for Red, 2 for Blue).
 */
export function movePlayerToTeam(playerId: number, teamId: number) {
    room.setPlayerTeam(playerId, teamId);
}

/**
 * Automatically assigns a player to the team with fewer players if there is space.
 */
export function autoAssignToTeam(playerId: number): boolean {
    const TEAM_SIZE_LIMIT = 3;
    const playerList = room.getPlayerList();
    const redCount = playerList.filter(p => p.team === 1).length;
    const blueCount = playerList.filter(p => p.team === 2).length;

    // Rule 1: First player alone -> move to RED
    if (playerList.length === 1) {
        movePlayerToTeam(playerId, 1);
        return true;
    }

    // Rule 2 & 3: Balance teams (up to 3x3)
    if (redCount < TEAM_SIZE_LIMIT || blueCount < TEAM_SIZE_LIMIT) {
        if (redCount < blueCount) {
            movePlayerToTeam(playerId, 1);
        } else if (blueCount < redCount) {
            movePlayerToTeam(playerId, 2);
        } else {
            // Equal (e.g. 1v1 or 2v2): assign to BLUE
            movePlayerToTeam(playerId, 2);
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

    const playerList = room.getPlayerList();
    const redCount = playerList.filter(p => p.team === 1).length;
    const blueCount = playerList.filter(p => p.team === 2).length;

    // Start if teams are balanced, have at least 1 player each, and total players in teams >= 2
    if (redCount > 0 && redCount === blueCount) {
        room.startGame();
    }
}

export function movePlayerToSpec(playerId: number) {
    room.setPlayerTeam(playerId, 0);
    removePlayerFromAfkMapsAndSets(playerId);
}

export function moveOneSpecToEachTeam(): void {
    const nextSpec1 = getNextSpectator();
    if (nextSpec1) movePlayerToTeam(nextSpec1.id, 1);
    const nextSpec2 = getNextSpectator();
    if (nextSpec2) movePlayerToTeam(nextSpec2.id, 2);
}

export function moveLastOppositeTeamMemberToSpec(oppositeTeamId: number): void {
    const oppositeTeamPlayers = room.getPlayerList().filter(p => p.team === oppositeTeamId);
    if (oppositeTeamPlayers.length > 0) {
        movePlayerToSpec(oppositeTeamPlayers[oppositeTeamPlayers.length - 1]!.id);
    }
}

/**
 * Handles team win logic: 
 * - Winners stay.
 * - Losers go to spec.
 * - Top spectator moves to the losing team automatically.
 */
export function handleTeamWin(winningTeamId: number) {
    const losingTeamId = winningTeamId === 1 ? 2 : 1;
    const losers = room.getPlayerList().filter(p => p.team === losingTeamId);
    
    // Move all losers to spec
    losers.forEach(p => movePlayerToSpec(p.id));

    // Move the FIRST available spectator to the losing team automatically
    const nextSpec = getNextSpectator();
    if (nextSpec) {
        room.sendAnnouncement(`📢 Auto-pick: ${nextSpec.name} moved to the losing team.`, undefined, 0x00FF00, "bold", 0);
        movePlayerToTeam(nextSpec.id, losingTeamId);
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
