import { supabase } from "./database.js";

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
    { name: "Unranked", minElo: 0, maxElo: 499, color: 0xAAAAAA, level: "0" },
    { name: "Bronze I", minElo: 500, maxElo: 699, color: 0xCD7F32, level: "1" },
    { name: "Bronze II", minElo: 700, maxElo: 899, color: 0xCD7F32, level: "2" },
    { name: "Bronze III", minElo: 900, maxElo: 1099, color: 0xCD7F32, level: "3" },
    { name: "Silver I", minElo: 1100, maxElo: 1299, color: 0xE0E0E0, level: "1" },
    { name: "Silver II", minElo: 1300, maxElo: 1499, color: 0xE0E0E0, level: "2" },
    { name: "Silver III", minElo: 1500, maxElo: 1699, color: 0xE0E0E0, level: "3" },
    { name: "Gold I", minElo: 1700, maxElo: 1899, color: 0xFFD700, level: "1" },
    { name: "Gold II", minElo: 1900, maxElo: 2099, color: 0xFFD700, level: "2" },
    { name: "Gold III", minElo: 2100, maxElo: 2299, color: 0xFFD700, level: "3" },
    { name: "Platinum I", minElo: 2300, maxElo: 2499, color: 0x00FFFF, level: "1" },
    { name: "Platinum II", minElo: 2500, maxElo: 2699, color: 0x00FFFF, level: "2" },
    { name: "Platinum III", minElo: 2700, maxElo: 2899, color: 0x00FFFF, level: "3" },
    { name: "Diamond I", minElo: 2900, maxElo: 3099, color: 0x0099FF, level: "1" },
    { name: "Diamond II", minElo: 3100, maxElo: 3299, color: 0x0099FF, level: "2" },
    { name: "Diamond III", minElo: 3300, maxElo: 3499, color: 0x0099FF, level: "3" },
    { name: "Champion", minElo: 3500, maxElo: Infinity, color: 0xFF0000, level: "MAX" },
    { name: "VIP", minElo: -1, maxElo: -1, color: 0xFFFF00, level: "GOD" }
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
 * Uses an UPSERT pattern to ensure the player exists before returning.
 */
export async function getPlayerStatsFromDB(playerName: string): Promise<PlayerStats> {
    if (!playerName || playerName.trim() === "") {
        return { name: "Unknown", wins: 0, goals: 0, assists: 0, rank: "Unranked", elo: 1000 };
    }
    
    try {
        // Step 1: Ensure player exists (UPSERT style)
        // We use upsert with 'onConflict' on the 'name' column
        const { data, error } = await supabase
            .from('players')
            .upsert({ name: playerName }, { onConflict: 'name' })
            .select()
            .single();

        if (error) {
            // If the error is that it wasn't found (unlikely with upsert but for safety)
            // or any other error, we log it.
            console.error("Supabase error in getPlayerStatsFromDB:", error.message);
            throw error;
        }

        const stats: PlayerStats = data;
        
        // Update cache
        playerStatsCache.set(playerName, stats);
        return stats;
    } catch (err) {
        console.error("Database error in getPlayerStatsFromDB:", err);
        const defaultStats: PlayerStats = { name: playerName, wins: 0, goals: 0, assists: 0, rank: "Unranked", elo: 1000 };
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
 * Uses an UPSERT pattern to ensure the player exists before updating the rank.
 */
export async function setPlayerRankInDB(playerName: string, rankName: string) {
    if (!playerName || playerName.trim() === "") return false;
    
    try {
        // Step 1: Ensure player exists and update rank
        const { error } = await supabase
            .from('players')
            .upsert({ name: playerName, rank: rankName }, { onConflict: 'name' });

        if (error) throw error;

        // Update local cache for immediate chat update
        const stats = playerStatsCache.get(playerName);
        if (stats) stats.rank = rankName;
        
        return true;
    } catch (err) {
        console.error("Database error in setPlayerRankInDB:", err);
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
        const stats = await getPlayerStatsFromDB(playerName);
        const newGoals = stats.goals + 1;
        
        const { error } = await supabase
            .from('players')
            .update({ goals: newGoals })
            .eq('name', playerName);

        if (error) throw error;

        // Update cache if player is online
        const cached = playerStatsCache.get(playerName);
        if (cached) cached.goals = newGoals;
    } catch (err) {
        console.error("Error updating goals:", err);
    }
}

/**
 * Updates a player's assist count in the database.
 */
export async function updatePlayerAssists(playerName: string) {
    try {
        const stats = await getPlayerStatsFromDB(playerName);
        const newAssists = stats.assists + 1;

        const { error } = await supabase
            .from('players')
            .update({ assists: newAssists })
            .eq('name', playerName);

        if (error) throw error;

        // Update cache if player is online
        const cached = playerStatsCache.get(playerName);
        if (cached) cached.assists = newAssists;
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
        const newWins = stats.wins + 1;
        
        let updateData: any = { wins: newWins, elo: newElo };

        // Automatic rank progression: only for non-VIP players
        if (stats.rank !== "VIP") {
            const newRankObj = getRankObjectByElo(newElo);
            updateData.rank = newRankObj.name;
            
            const cached = playerStatsCache.get(playerName);
            if (cached) {
                cached.wins = newWins;
                cached.elo = newElo;
                cached.rank = newRankObj.name;
            }
        } else {
            // VIPs keep their rank, only Elo and wins increase
            const cached = playerStatsCache.get(playerName);
            if (cached) {
                cached.wins = newWins;
                cached.elo = newElo;
            }
        }

        const { error } = await supabase
            .from('players')
            .update(updateData)
            .eq('name', playerName);

        if (error) throw error;
    } catch (err) {
        console.error("Error updating win:", err);
    }
}

/**
 * Updates Elo for the !setelo command (if still used)
 */
export async function setPlayerEloInDB(playerName: string, targetElo: number) {
    try {
        const { error } = await supabase
            .from('players')
            .update({ elo: targetElo })
            .eq('name', playerName);

        if (error) throw error;

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
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .order('elo', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error("Error fetching top players:", err);
        return [];
    }
}
