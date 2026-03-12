import { room } from "./index.js";

/**
 * Interface for tracking player statistics
 */
export interface PlayerStats {
    wins: number;
    goals: number;
    assists: number;
    matchesPlayed: number;
}

/**
 * Map to store player stats keyed by their unique authentication string.
 * This ensures stats persist even if the player re-joins during the session.
 */
export const playerStatsMap = new Map<string, PlayerStats>();

/**
 * Ranking thresholds based on number of wins
 */
export const RANKS = [
    { name: "Bronze", minWins: 0, maxWins: 10 },
    { name: "Silver", minWins: 11, maxWins: 25 },
    { name: "Gold", minWins: 26, maxWins: 50 },
    { name: "Platinum", minWins: 51, maxWins: 80 },
    { name: "Diamond", minWins: 81, maxWins: Infinity }
];

/**
 * Retrieves or initializes stats for a player
 */
export function getPlayerStats(player: PlayerObject): PlayerStats {
    let stats = playerStatsMap.get(player.auth);
    if (!stats) {
        stats = { wins: 0, goals: 0, assists: 0, matchesPlayed: 0 };
        playerStatsMap.set(player.auth, stats);
    }
    return stats;
}

/**
 * Determines the rank name based on win count
 */
export function getRank(wins: number): string {
    const rank = RANKS.find(r => wins >= r.minWins && wins <= r.maxWins);
    return rank ? rank.name : "Bronze";
}

/**
 * Updates a player's statistics
 */
export function updatePlayerStats(playerAuth: string, update: Partial<PlayerStats>) {
    const stats = playerStatsMap.get(playerAuth);
    if (stats) {
        if (update.wins !== undefined) stats.wins += update.wins;
        if (update.goals !== undefined) stats.goals += update.goals;
        if (update.assists !== undefined) stats.assists += update.assists;
        if (update.matchesPlayed !== undefined) stats.matchesPlayed += update.matchesPlayed;
    }
}

/**
 * Gets the top players for the leaderboard
 */
export function getTopPlayers(limit: number = 10) {
    return Array.from(playerStatsMap.entries())
        .map(([auth, stats]) => ({ auth, stats }))
        .sort((a, b) => b.stats.wins - a.stats.wins)
        .slice(0, limit);
}

/**
 * Map to store the last known name for each player auth, 
 * used for displaying names in the leaderboard even if players are offline.
 */
export const playerNames = new Map<string, string>();
