import { removePlayerFromAfkMapsAndSets, setPickTimeout } from "./afkdetection.js";
import { room, isStadiumChangePending } from "./index.js";
import { autoBalanceTeams, resetAndAutoAssign, canMatchStart } from "./autopick.js";

const TEAM_SIZE_LIMIT = 3;

/**
 * Moves a player to a specific team (1 for Red, 2 for Blue).
 */
export function movePlayerToTeam(playerId: number, teamId: number) {
    room.setPlayerTeam(playerId, teamId);
    // If moving from spectator to a team, reset their activity
    if (teamId !== 0) {
        removePlayerFromAfkMapsAndSets(playerId);
    }
}

/**
 * Automatically assigns a player to the team with fewer players if there is space.
 * Used when a player manually tries to join or when someone joins the room.
 */
export function autoAssignToTeam(playerId: number): boolean {
    if (isStadiumChangePending()) return false;
    
    const playerList = room.getPlayerList();
    const redCount = playerList.filter(p => p.team === 1).length;
    const blueCount = playerList.filter(p => p.team === 2).length;

    // Balance teams (up to 3x3)
    if (redCount < TEAM_SIZE_LIMIT || blueCount < TEAM_SIZE_LIMIT) {
        if (redCount <= blueCount && redCount < TEAM_SIZE_LIMIT) {
            movePlayerToTeam(playerId, 1);
        } else if (blueCount < redCount && blueCount < TEAM_SIZE_LIMIT) {
            movePlayerToTeam(playerId, 2);
        } else if (blueCount < TEAM_SIZE_LIMIT) {
            movePlayerToTeam(playerId, 2);
        }
        return true;
    }
    return false;
}

/**
 * Enforces 3v3 rules:
 * - Fills teams from spec if underfilled.
 * - Moves extra players to spec if team > 3.
 * - Starts game only if exactly 3v3.
 */
export function applyPlayerCountLogic(): void {
    if (isStadiumChangePending()) return;
    
    // Auto balance teams first
    autoBalanceTeams();

    // Auto Start if game not running and we have exactly 3v3
    const scores = room.getScores();
    if (scores === null) {
        if (canMatchStart()) {
            room.startGame();
        } else {
            const redCount = room.getPlayerList().filter(p => p.team === 1).length;
            const blueCount = room.getPlayerList().filter(p => p.team === 2).length;
            if (redCount < 3 || blueCount < 3) {
                // room.sendAnnouncement("⌛ Waiting for more players to reach 3v3...", undefined, 0xFFFF00, "normal");
            }
        }
    }
}

export function movePlayerToSpec(playerId: number) {
    room.setPlayerTeam(playerId, 0);
    removePlayerFromAfkMapsAndSets(playerId);
    setPickTimeout(playerId); // Set 10s pick timeout when moving to spectators
}

/**
 * Handles team win logic: 
 * - Requirement 3: All players reset to spec and then auto-assigned to maintain 3v3 balance.
 */
export function handleTeamWin(_winningTeamId: number) {
    room.sendAnnouncement("🏆 Match ended! Resetting teams for the next 3v3 match...", undefined, 0x00FF00, "bold");
    resetAndAutoAssign();
}

