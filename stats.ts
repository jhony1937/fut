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
 * Complete ranking system with 3-tier levels, Champion, and manual VIP
 */
export const RANKS = [
    { name: "Unranked", minElo: 0, maxElo: 499, color: 0x999999 },      // Grey
    { name: "Bronze I", minElo: 500, maxElo: 699, color: 0xCD7F32 },
    { name: "Bronze II", minElo: 700, maxElo: 899, color: 0xCD7F32 },
    { name: "Bronze III", minElo: 900, maxElo: 1099, color: 0xCD7F32 },
    { name: "Silver I", minElo: 1100, maxElo: 1299, color: 0xC0C0C0 },
    { name: "Silver II", minElo: 1300, maxElo: 1499, color: 0xC0C0C0 },
    { name: "Silver III", minElo: 1500, maxElo: 1699, color: 0xC0C0C0 },
    { name: "Gold I", minElo: 1700, maxElo: 1899, color: 0xFFD700 },
    { name: "Gold II", minElo: 1900, maxElo: 2099, color: 0xFFD700 },
    { name: "Gold III", minElo: 2100, maxElo: 2299, color: 0xFFD700 },
    { name: "Platinum I", minElo: 2300, maxElo: 2499, color: 0xE5E4E2 },
    { name: "Platinum II", minElo: 2500, maxElo: 2699, color: 0xE5E4E2 },
    { name: "Platinum III", minElo: 2700, maxElo: 2899, color: 0xE5E4E2 },
    { name: "Diamond I", minElo: 2900, maxElo: 3099, color: 0xB9F2FF },
    { name: "Diamond II", minElo: 3100, maxElo: 3299, color: 0xB9F2FF },
    { name: "Diamond III", minElo: 3300, maxElo: 3499, color: 0xB9F2FF },
    { name: "Champion", minElo: 3500, maxElo: Infinity, color: 0xFF0000 }, // Vivid Red
    { name: "VIP", minElo: -1, maxElo: -1, color: 0xFFFF00 } // Manual assignment only
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
        const defaultStats: PlayerStats = { name: playerName, wins: 0, goals: 0, assists: 0, rank: "Unranked", elo: 0 };
        playerStatsCache.set(playerName, defaultStats);
        return defaultStats;
    }
}

/**
 * Determines the rank object based on Elo for automatic progression
 */
export function getRankObjectByElo(elo: number) {
    // Filter out VIP as it's manual only
    const autoRanks = RANKS.filter(r => r.name !== "VIP");
    const rank = autoRanks.find(r => elo >= r.minElo && elo <= r.maxElo);
    return rank || autoRanks[0]!;
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
 * Also handles automatic rank progression (except for VIPs).
 */
export async function updatePlayerWin(playerName: string, eloGain: number = 20) {
    try {
        const stats = await getPlayerStatsFromDB(playerName);
        const newElo = stats.elo + eloGain;
        
        let updateQuery: string;
        let queryParams: any[];

        // Automatic rank progression: only for non-VIP players
        if (stats.rank !== "VIP") {
            const newRankObj = getRankObjectByElo(newElo);
            updateQuery = 'UPDATE players SET wins = wins + 1, elo = $1, rank = $2 WHERE name = $3';
            queryParams = [newElo, newRankObj.name, playerName];
            
            const cached = playerStatsCache.get(playerName);
            if (cached) {
                cached.wins += 1;
                cached.elo = newElo;
                cached.rank = newRankObj.name;
            }
        } else {
            // VIPs keep their rank, only Elo and wins increase
            updateQuery = 'UPDATE players SET wins = wins + 1, elo = $1 WHERE name = $2';
            queryParams = [newElo, playerName];
            
            const cached = playerStatsCache.get(playerName);
            if (cached) {
                cached.wins += 1;
                cached.elo = newElo;
            }
        }

        await db.query(updateQuery, queryParams);
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
