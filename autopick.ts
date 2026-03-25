import { room } from "./index.js";
import { getQueueList } from "./spectatorQueue.js";
import { removePlayerFromAfkMapsAndSets } from "./afkdetection.js";

const TEAM_SIZE = 3;

/**
 * Automatically balances teams for a 3v3 match.
 * Fills Red first, then Blue from the spectator queue.
 */
export function autoBalanceTeams(): void {
    const players = room.getPlayerList();
    const redTeam = players.filter(p => p.team === 1);
    const blueTeam = players.filter(p => p.team === 2);
    const spectators = getQueueList();

    // 1. Ensure teams don't exceed 3 players
    if (redTeam.length > TEAM_SIZE) {
        redTeam.slice(TEAM_SIZE).forEach(p => room.setPlayerTeam(p.id, 0));
    }
    if (blueTeam.length > TEAM_SIZE) {
        blueTeam.slice(TEAM_SIZE).forEach(p => room.setPlayerTeam(p.id, 0));
    }

    // 2. Re-fetch current counts
    const currentRed = room.getPlayerList().filter(p => p.team === 1).length;
    const currentBlue = room.getPlayerList().filter(p => p.team === 2).length;

    // 3. Fill teams from spectator queue
    let specIndex = 0;

    // Fill Red
    for (let i = currentRed; i < TEAM_SIZE && specIndex < spectators.length; i++) {
        const target = spectators[specIndex++];
        room.setPlayerTeam(target.id, 1);
        removePlayerFromAfkMapsAndSets(target.id);
    }

    // Fill Blue
    for (let i = currentBlue; i < TEAM_SIZE && specIndex < spectators.length; i++) {
        const target = spectators[specIndex++];
        room.setPlayerTeam(target.id, 2);
        removePlayerFromAfkMapsAndSets(target.id);
    }
}

/**
 * Resets all players to spectators and then auto-assigns them for a fresh 3v3 match.
 */
export function resetAndAutoAssign(): void {
    const players = room.getPlayerList();
    
    // Move everyone to spec
    players.forEach(p => room.setPlayerTeam(p.id, 0));

    // Wait a tiny bit for the team change to register if needed (though setPlayerTeam is usually sync)
    setTimeout(() => {
        autoBalanceTeams();
    }, 100);
}

/**
 * Checks if a 3v3 match can start.
 */
export function canMatchStart(): boolean {
    const redCount = room.getPlayerList().filter(p => p.team === 1).length;
    const blueCount = room.getPlayerList().filter(p => p.team === 2).length;
    return redCount === TEAM_SIZE && blueCount === TEAM_SIZE;
}

