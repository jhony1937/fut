import * as db from "./database.js";

/**
 * Interface for tracking player statistics in memory
 */
export interface PlayerStats {
    id?: number;
    name: string;
    wins: number;
    goals: number;
    assists: number;
    rank: string;
    elo: number;
}

/**
 * Manual ranking definitions with specific hex colors
 */
export const RANKS = [
    { name: "Bronze I", color: 0xCD7F32 },
    { name: "Bronze II", color: 0xCD7F32 },
    { name: "Bronze III", color: 0xCD7F32 },
    { name: "Silver I", color: 0xC0C0C0 },
    { name: "Silver II", color: 0xC0C0C0 },
    { name: "Silver III", color: 0xC0C0C0 },
    { name: "Gold I", color: 0xFFD700 },
    { name: "Gold II", color: 0xFFD700 },
    { name: "Gold III", color: 0xFFD700 },
    { name: "Platinum I", color: 0xE5E4E2 },
    { name: "Platinum II", color: 0xE5E4E2 },
    { name: "Platinum III", color: 0xE5E4E2 },
    { name: "Diamond I", color: 0xB9F2FF },
    { name: "Diamond II", color: 0xB9F2FF },
    { name: "Diamond III", color: 0xB9F2FF },
    { name: "VIP", color: 0xFFFF00 } // Flashy/Glow color
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
        const defaultStats: PlayerStats = { name: playerName, wins: 0, goals: 0, assists: 0, rank: "Bronze I", elo: 1000 };
        playerStatsCache.set(playerName, defaultStats);
        return defaultStats;
    }
}

/**
 * Updates a player's rank manually in the database.
 */
export async function setPlayerRankInDB(playerName: string, rankName: string) {
    try {
        await db.query('UPDATE players SET rank = $1 WHERE name = $2', [rankName, playerName]);
        const stats = playerStatsCache.get(playerName);
        if (stats) stats.rank = rankName;
        return true;
    } catch (err) {
        console.error("Error setting manual rank:", err);
        return false;
    }
}

/**
 * Determines the rank object based on the rank name
 */
export function getRankObjectByName(rankName: string) {
    const rank = RANKS.find(r => r.name.toLowerCase() === rankName.toLowerCase());
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
 * Updates a player's assist count in the database.
 */
export async function updatePlayerAssists(playerName: string) {
    try {
        await db.query('UPDATE players SET assists = assists + 1 WHERE name = $1', [playerName]);
        // Update cache if player is online
        const stats = playerStatsCache.get(playerName);
        if (stats) stats.assists += 1;
    } catch (err) {
        console.error("Error updating assists:", err);
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
        // Manual rank system: do not update rank based on Elo
        await db.query(
            'UPDATE players SET wins = wins + 1, elo = $1 WHERE name = $2',
            [newElo, playerName]
        );
        const cached = playerStatsCache.get(playerName);
        if (cached) {
            cached.wins += 1;
            cached.elo = newElo;
        }
    } catch (err) {
        console.error("Error updating win:", err);
    }
}

/**
 * Updates Elo for the !setelo command (if still used)
 */
export async function setPlayerEloInDB(playerName: string, targetElo: number) {
    try {
        await db.query(
            'UPDATE players SET elo = $1 WHERE name = $2',
            [targetElo, playerName]
        );
        const stats = playerStatsCache.get(playerName);
        if (stats) stats.elo = targetElo;
        return true;
    } catch (err) {
        console.error("Error setting Elo manually:", err);
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
