import { room } from "./index.js";
import { getQueueList } from "./spectatorQueue.js";
import { removePlayerFromAfkMapsAndSets } from "./afkdetection.js";

/**
 * Returns the target team size based on the total number of players in the room.
 */
export function getTargetTeamSize(): number {
    const totalPlayers = room.getPlayerList().length;
    if (totalPlayers >= 6) return 3;
    if (totalPlayers >= 4) return 2;
    return 1;
}

/**
 * Automatically balances teams for 1v1, 2v2, or 3v3 matches.
 * Fills Red first, then Blue from the spectator queue.
 */
export function autoBalanceTeams(): void {
    const players = room.getPlayerList();
    const teamSize = getTargetTeamSize();
    const redTeam = players.filter(p => p.team === 1);
    const blueTeam = players.filter(p => p.team === 2);
    const spectators = getQueueList();

    // 1. Ensure teams don't exceed the current target team size
    if (redTeam.length > teamSize) {
        redTeam.slice(teamSize).forEach(p => room.setPlayerTeam(p.id, 0));
    }
    if (blueTeam.length > teamSize) {
        blueTeam.slice(teamSize).forEach(p => room.setPlayerTeam(p.id, 0));
    }

    // 2. Re-fetch current counts
    const currentRed = room.getPlayerList().filter(p => p.team === 1).length;
    const currentBlue = room.getPlayerList().filter(p => p.team === 2).length;

    // 3. Fill teams from spectator queue
    let specIndex = 0;

    // Fill Red
    for (let i = currentRed; i < teamSize && specIndex < spectators.length; i++) {
        const target = spectators[specIndex++];
        if (target) {
            room.setPlayerTeam(target.id, 1);
            removePlayerFromAfkMapsAndSets(target.id);
        }
    }

    // Fill Blue
    for (let i = currentBlue; i < teamSize && specIndex < spectators.length; i++) {
        const target = spectators[specIndex++];
        if (target) {
            room.setPlayerTeam(target.id, 2);
            removePlayerFromAfkMapsAndSets(target.id);
        }
    }
}

/**
 * Resets all players to spectators and then auto-assigns them for a fresh match.
 */
export function resetAndAutoAssign(): void {
    const players = room.getPlayerList();
    
    // Move everyone to spec
    players.forEach(p => room.setPlayerTeam(p.id, 0));

    // Wait a tiny bit for the team change to register
    setTimeout(() => {
        autoBalanceTeams();
    }, 100);
}

/**
 * Checks if a match can start based on current player counts.
 */
export function canMatchStart(): boolean {
    const players = room.getPlayerList();
    const teamSize = getTargetTeamSize();
    const redCount = players.filter(p => p.team === 1).length;
    const blueCount = players.filter(p => p.team === 2).length;
    
    // For 1v1, it can start with 1 player (Red) if there's only 1 person, 
    // but the requirement says 1v1, 2v2, 3v3 matches. 
    // Usually means balanced teams.
    return redCount === teamSize && blueCount === teamSize;
}

