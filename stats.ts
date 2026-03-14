import * as db from "./database.js";

/**
 * Interface for tracking player statistics in memory
 */
export interface PlayerStats {
    id?: number;
    name: string;
    wins: number;
    goals: number;
    rank: string;
    elo: number;
}

/**
 * Ranking thresholds based on Elo points with colors
 */
export const RANKS = [
    { name: "Bronze", minElo: 0, maxElo: 999, color: 0xCD7F32 },
    { name: "Silver", minElo: 1000, maxElo: 1499, color: 0xC0C0C0 },
    { name: "Gold", minElo: 1500, maxElo: 1999, color: 0xFFD700 },
    { name: "Platinum", minElo: 2000, maxElo: 2499, color: 0xE5E4E2 },
    { name: "Diamond", minElo: 2500, maxElo: Infinity, color: 0xB9F2FF }
];

/**
 * Map to store player stats keyed by their unique authentication string.
 * This ensures stats persist even if the player re-joins during the session.
 */
export const playerStatsMap = new Map<string, PlayerStats>();

/**
 * Map to store the last known name for each player auth, 
 * used for displaying names in the leaderboard even if players are offline.
 */
export const playerNames = new Map<string, string>();

/**
 * Map to cache player stats by name for synchronous access (e.g. in chat)
 */
export const playerStatsCache = new Map<string, PlayerStats>();

/**
 * Retrieves or initializes stats for a player from the database.
 * If player doesn't exist, inserts a new record.
 */
export async function getPlayerStatsFromDB(playerName: string): Promise<PlayerStats> {
    try {
        const res = await db.query('SELECT * FROM players WHERE name = $1', [playerName]);
        let stats: PlayerStats;
        if (res.rows.length > 0) {
            stats = res.rows[0];
        } else {
            // New player: insert into database
            const insertRes = await db.query(
                'INSERT INTO players (name) VALUES ($1) RETURNING *',
                [playerName]
            );
            stats = insertRes.rows[0];
        }
        // Update cache
        playerStatsCache.set(playerName, stats);
        return stats;
    } catch (err) {
        console.error("Error fetching/inserting player stats:", err);
        const defaultStats = { name: playerName, wins: 0, goals: 0, rank: "Bronze", elo: 1000 };
        playerStatsCache.set(playerName, defaultStats);
        return defaultStats;
    }
}

/**
 * Determines the rank name and color based on Elo count
 */
export function getRankObjectByElo(elo: number) {
    const rank = RANKS.find(r => elo >= r.minElo && elo <= r.maxElo);
    return rank || RANKS[0]!;
}

/**
 * Updates a player's goal count in the database.
 */
export async function updatePlayerGoals(playerName: string) {
    try {
        await db.query('UPDATE players SET goals = goals + 1 WHERE name = $1', [playerName]);
        // Update cache if player is online
        const stats = playerStatsCache.get(playerName);
        if (stats) stats.goals += 1;
    } catch (err) {
        console.error("Error updating goals:", err);
    }
}

/**
 * Updates a player's win count and Elo in the database.
 */
export async function updatePlayerWin(playerName: string, eloGain: number = 20) {
    try {
        // Fetch current Elo to update rank if needed
        const stats = await getPlayerStatsFromDB(playerName);
        const newElo = stats.elo + eloGain;
        const newRankObj = getRankObjectByElo(newElo);

        await db.query(
            'UPDATE players SET wins = wins + 1, elo = $1, rank = $2 WHERE name = $3',
            [newElo, newRankObj.name, playerName]
        );
        // getPlayerStatsFromDB already updates the cache, but we need to update the wins/elo/rank manually here 
        // to avoid another DB call if we wanted to be super efficient, but getPlayerStatsFromDB is fine.
        // Actually, let's just update the cache directly.
        const cached = playerStatsCache.get(playerName);
        if (cached) {
            cached.wins += 1;
            cached.elo = newElo;
            cached.rank = newRankObj.name;
        }
    } catch (err) {
        console.error("Error updating win:", err);
    }
}

/**
 * Directly updates Elo and Rank for the !setrank command (if still used)
 */
export async function setPlayerEloAndRank(playerName: string, targetElo: number) {
    const rankObj = getRankObjectByElo(targetElo);
    try {
        await db.query(
            'UPDATE players SET elo = $1, rank = $2 WHERE name = $3',
            [targetElo, rankObj.name, playerName]
        );
        return true;
    } catch (err) {
        console.error("Error setting rank manually:", err);
        return false;
    }
}

/**
 * Gets the top players for the leaderboard ordered by Elo
 */
export async function getTopPlayersFromDB(limit: number = 10): Promise<PlayerStats[]> {
    try {
        const res = await db.query('SELECT * FROM players ORDER BY elo DESC LIMIT $1', [limit]);
        return res.rows;
    } catch (err) {
        console.error("Error fetching top players:", err);
        return [];
    }
}
