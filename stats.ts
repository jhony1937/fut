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
 * Retrieves or initializes stats for a player from the database.
 * If player doesn't exist, inserts a new record.
 */
export async function getPlayerStatsFromDB(playerName: string): Promise<PlayerStats> {
    try {
        const res = await db.query('SELECT * FROM players WHERE name = $1', [playerName]);
        if (res.rows.length > 0) {
            return res.rows[0];
        } else {
            // New player: insert into database
            const insertRes = await db.query(
                'INSERT INTO players (name) VALUES ($1) RETURNING *',
                [playerName]
            );
            return insertRes.rows[0];
        }
    } catch (err) {
        console.error("Error fetching/inserting player stats:", err);
        return { name: playerName, wins: 0, goals: 0, rank: "Bronze", elo: 1000 };
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
