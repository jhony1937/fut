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
 * Ranking thresholds based on number of wins with divisions and colors
 */
export const RANKS = [
    { name: "Unranked", minWins: 0, maxWins: 0, color: 0xFFFFFF },
    { name: "Bronze I", minWins: 1, maxWins: 5, color: #662200 },
    { name: "Bronze II", minWins: 6, maxWins: 10, color: #662200 },
    { name: "Bronze III", minWins: 11, maxWins: 15, color: #662200 },
    { name: "Silver I", minWins: 16, maxWins: 20, color: #a7a7a5 },
    { name: "Silver II", minWins: 21, maxWins: 30, color: #a7a7a5 },
    { name: "Silver III", minWins: 31, maxWins: 40, color: #a7a7a5 },
    { name: "Gold I", minWins: 41, maxWins: 55, color: #ffd11a },
    { name: "Gold II", minWins: 56, maxWins: 70, color: #ffd11a },
    { name: "Gold III", minWins: 71, maxWins: 90, color: #ffd11a },
    { name: "Platinum I", minWins: 91, maxWins: 110, color: #005ce6 },
    { name: "Platinum II", minWins: 111, maxWins: 130, color: #005ce6 },
    { name: "Platinum III", minWins: 131, maxWins: 150, color: #005ce6 },
    { name: "Diamond I", minWins: 151, maxWins: 175, color: #00ace6 },
    { name: "Diamond II", minWins: 176, maxWins: 200, color: #00ace6 },
    { name: "Diamond III", minWins: 201, maxWins: Infinity, color: #00ace6 }
];

/**
 * Retrieves or initializes stats for a player
 */
export function getPlayerStats(player: PlayerObject): PlayerStats {
    let stats = playerStatsMap.get(player.auth);
    if (!stats) {
        // Every new player that joins for the first time starts with 0 wins (Unranked)
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
    return rank ? rank.name : "Unranked";
}

/**
 * Determines the full rank object based on win count (for color and name)
 */
export function getRankObject(wins: number) {
    const rank = RANKS.find(r => wins >= r.minWins && wins <= r.maxWins);
    return rank || RANKS[0]!;
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

/**
 * Manually sets a player's wins to match the minimum required for a specific rank name.
 */
export function setPlayerRankByName(playerAuth: string, rankName: string): boolean {
    const rank = RANKS.find(r => r.name.toLowerCase() === rankName.toLowerCase());
    if (!rank) return false;

    const stats = playerStatsMap.get(playerAuth);
    if (stats) {
        stats.wins = rank.minWins;
        return true;
    }
    return false;
}

