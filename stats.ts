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
 * "iknow" Scorer System: tracks player IDs who have scored
 */
export const iknowScorers = new Set<number>();

/**
 * Adds a player to the "iknow" scorer system using their player ID as the user
 */
export function addPlayerToIKnow(playerId: number) {
    iknowScorers.add(playerId);
    console.log(`[iknow] Player ID ${playerId} added to the system.`);
}

/**
 * Retrieves or initializes stats for a player from the database.
 * Uses an UPSERT pattern to ensure the player exists before returning.
 */
export async function getPlayerStatsFromDB(playerName: string): Promise<PlayerStats> {
    const normalizedName = (playerName || "").trim();
    if (!normalizedName) {
        const fallbackStats: PlayerStats = { name: "Unknown", wins: 0, goals: 0, assists: 0, rank: "Unranked", elo: 1000 };
        playerStatsCache.set("Unknown", fallbackStats);
        return fallbackStats;
    }

    try {
        // Step 1: Try to read existing player stats from DB
        const { data: existingData, error: selectError } = await supabase
            .from('players')
            .select('*')
            .eq('name', normalizedName);

        if (selectError) {
            console.error("Supabase select error in getPlayerStatsFromDB:", selectError.message);
            throw selectError;
        }

        let statsRow: any = existingData && existingData.length > 0 ? existingData[0] : null;

        // Step 2: If no row exists, create a new default row
        if (!statsRow) {
            const defaultRow = {
                name: normalizedName,
                wins: 0,
                goals: 0,
                assists: 0,
                rank: "Bronze I",
                elo: 1000
            };

            const { data: insertedData, error: insertError } = await supabase
                .from('players')
                .insert(defaultRow)
                .select('*')
                .single();

            if (insertError) {
                console.error("Supabase insert error in getPlayerStatsFromDB:", insertError.message);
                throw insertError;
            }

            statsRow = insertedData;
        }

        // Step 3: Normalize safe return values
        const stats: PlayerStats = {
            id: statsRow.id,
            name: statsRow.name || normalizedName,
            wins: Number.isFinite(statsRow.wins) ? statsRow.wins : 0,
            goals: Number.isFinite(statsRow.goals) ? statsRow.goals : 0,
            assists: Number.isFinite(statsRow.assists) ? statsRow.assists : 0,
            elo: Number.isFinite(statsRow.elo) ? statsRow.elo : 1000,
            rank: typeof statsRow.rank === "string" && statsRow.rank.trim() !== "" ? statsRow.rank : "Bronze I"
        };

        playerStatsCache.set(stats.name, stats);
        return stats;
    } catch (err) {
        console.error("Database error in getPlayerStatsFromDB:", err);
        const defaultStats: PlayerStats = { name: normalizedName, wins: 0, goals: 0, assists: 0, rank: "Bronze I", elo: 1000 };
        playerStatsCache.set(normalizedName, defaultStats);
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
 * Returns: "success", "not_found", or "error"
 */
export async function setPlayerRankInDB(playerName: string, rankName: string): Promise<"success" | "not_found" | "error"> {
    if (!playerName || playerName.trim() === "") return "error";
    
    try {
        // Step 1: Attempt to update the player rank
        // We use .select() to verify if any row was actually updated
        const { data, error } = await supabase
            .from('players')
            .update({ rank: rankName })
            .ilike('name', playerName) // Case-insensitive match
            .select();

        if (error) {
            console.error("Supabase error in setPlayerRankInDB:", error.message);
            return "error";
        }

        if (!data || data.length === 0) {
            return "not_found";
        }

        // Update local cache for immediate chat update
        const updatedStats = data[0] as PlayerStats;
        playerStatsCache.set(updatedStats.name, updatedStats);
        
        return "success";
    } catch (err) {
        console.error("Unexpected error in setPlayerRankInDB:", err);
        return "error";
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
 * Updates a player's wins manually in the database.
 * Returns: "success", "not_found", or "error"
 */
export async function setPlayerWinsInDB(playerName: string, wins: number): Promise<"success" | "not_found" | "error"> {
    if (!playerName || playerName.trim() === "") return "error";
    try {
        const { data, error } = await supabase.from('players').update({ wins }).ilike('name', playerName).select();
        if (error) return "error";
        if (!data || data.length === 0) return "not_found";
        const updatedStats = data[0] as PlayerStats;
        playerStatsCache.set(updatedStats.name, updatedStats);
        return "success";
    } catch (err) {
        return "error";
    }
}

/**
 * Updates a player's goals manually in the database.
 * Returns: "success", "not_found", or "error"
 */
export async function setPlayerGoalsInDB(playerName: string, goals: number): Promise<"success" | "not_found" | "error"> {
    if (!playerName || playerName.trim() === "") return "error";
    try {
        const { data, error } = await supabase.from('players').update({ goals }).ilike('name', playerName).select();
        if (error) return "error";
        if (!data || data.length === 0) return "not_found";
        const updatedStats = data[0] as PlayerStats;
        playerStatsCache.set(updatedStats.name, updatedStats);
        return "success";
    } catch (err) {
        return "error";
    }
}

/**
 * Updates a player's assists manually in the database.
 * Returns: "success", "not_found", or "error"
 */
export async function setPlayerAssistsInDB(playerName: string, assists: number): Promise<"success" | "not_found" | "error"> {
    if (!playerName || playerName.trim() === "") return "error";
    try {
        const { data, error } = await supabase.from('players').update({ assists }).ilike('name', playerName).select();
        if (error) return "error";
        if (!data || data.length === 0) return "not_found";
        const updatedStats = data[0] as PlayerStats;
        playerStatsCache.set(updatedStats.name, updatedStats);
        return "success";
    } catch (err) {
        return "error";
    }
}

/**
 * Gets top players ordered by a specific stat
 */
export async function getTopPlayersByStat(stat: "elo" | "wins" | "goals" | "assists", limit: number = 10): Promise<PlayerStats[]> {
    try {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .order(stat, { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error(`Error fetching top players by ${stat}:`, err);
        return [];
    }
}
