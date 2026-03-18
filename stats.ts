import { supabase } from "./database.js";

/**
 * Interface for tracking player statistics
 */
export interface PlayerStats {
    id?: number;
    name: string;
    wins: number;
    goals: number;
    assists: number;
    rank: string;
}

/**
 * Rank system based on wins only
 */
export const RANKS = [
  { name: 'Champion', wins: 120, color: 0xFF0000 },
  { name: 'Diamond III', wins: 100, color: 0x0099FF },
  { name: 'Diamond II', wins: 90, color: 0x0099FF },
  { name: 'Diamond I', wins: 80, color: 0x0099FF },
  { name: 'Platinum III', wins: 70, color: 0x00FFFF },
  { name: 'Platinum II', wins: 60, color: 0x00FFFF },
  { name: 'Platinum I', wins: 50, color: 0x00FFFF },
  { name: 'Gold III', wins: 45, color: 0xFFD700 },
  { name: 'Gold II', wins: 40, color: 0xFFD700 },
  { name: 'Gold I', wins: 35, color: 0xFFD700 },
  { name: 'Silver III', wins: 30, color: 0xE0E0E0 },
  { name: 'Silver II', wins: 25, color: 0xE0E0E0 },
  { name: 'Silver I', wins: 20, color: 0xE0E0E0 },
  { name: 'Bronze III', wins: 15, color: 0xCD7F32 },
  { name: 'Bronze II', wins: 10, color: 0xCD7F32 },
  { name: 'Bronze I', wins: 5, color: 0xCD7F32 },
  { name: 'Unranked', wins: 0, color: 0xAAAAAA }
];

export function getRankByWins(wins: number): string {
  for (const rank of RANKS) {
    if (wins >= rank.wins) return rank.name;
  }
  return 'Unranked';
}

export const playerNames = new Map<string, string>();
/**
 * Local cache for online player stats
 */
export const playerStatsCache = new Map<string, PlayerStats>();

/**
 * Retrieves or initializes stats for a player from the database.
 */
export async function getPlayerStatsFromDB(playerName: string): Promise<PlayerStats> {
    const normalizedName = playerName.trim();
    
    // Step 1: Check cache
    if (playerStatsCache.has(normalizedName)) {
        return playerStatsCache.get(normalizedName)!;
    }

    try {
        // Step 2: Try to read from DB
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('name', normalizedName)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Supabase select error:", error.message);
            throw error;
        }

        if (data) {
            playerStatsCache.set(normalizedName, data as PlayerStats);
            return data as PlayerStats;
        }

        // Step 3: If no row exists, create a new one
        const newPlayer = {
            name: normalizedName,
            wins: 0,
            goals: 0,
            assists: 0,
            rank: "Unranked"
        };

        const { data: insertedData, error: insertError } = await supabase
            .from('players')
            .insert([newPlayer])
            .select()
            .single();

        if (insertError) {
            console.error("Supabase insert error:", insertError.message);
            throw insertError;
        }

        playerStatsCache.set(normalizedName, insertedData as PlayerStats);
        return insertedData as PlayerStats;
    } catch (err) {
        console.error("Unexpected error in getPlayerStatsFromDB:", err);
        return { name: normalizedName, wins: 0, goals: 0, assists: 0, rank: "Unranked" };
    }
}

/**
 * Updates a player's stats in the database and cache.
 */
export async function updatePlayerStats(playerName: string, updates: Partial<PlayerStats>) {
    try {
        const { data, error } = await supabase
            .from('players')
            .update(updates)
            .eq('name', playerName)
            .select()
            .single();

        if (error) throw error;
        
        if (data) {
            playerStatsCache.set(playerName, data as PlayerStats);
        }
    } catch (err) {
        console.error("Error updating stats:", err);
    }
}

/**
 * Updates a player's goal count.
 */
export async function incrementGoals(playerName: string) {
    const stats = await getPlayerStatsFromDB(playerName);
    await updatePlayerStats(playerName, { goals: stats.goals + 1 });
}

/**
 * Updates a player's assist count.
 */
export async function incrementAssists(playerName: string) {
    const stats = await getPlayerStatsFromDB(playerName);
    await updatePlayerStats(playerName, { assists: stats.assists + 1 });
}

/**
 * Updates a player's win count and rank.
 */
export async function incrementWin(playerName: string): Promise<{ rankedUp: boolean, newRank: string }> {
    const stats = await getPlayerStatsFromDB(playerName);
    const newWins = stats.wins + 1;
    const newRank = getRankByWins(newWins);
    const rankedUp = newRank !== stats.rank;

    await updatePlayerStats(playerName, { wins: newWins, rank: newRank });
    return { rankedUp, newRank };
}

/**
 * Determines the rank object based on the rank name
 */
export function getRankObjectByName(rankName: string) {
    const rank = RANKS.find(r => r.name.toLowerCase() === rankName.toLowerCase());
    return rank || RANKS[RANKS.length - 1]!; // Default to Unranked (last in array)
}

const iknowScorers = new Set<number>();
/**
 * Adds a player to the "iknow" scorer system using their player ID as the user
 */
export function addPlayerToIKnow(playerId: number) {
    iknowScorers.add(playerId);
    console.log(`[iknow] Player ID ${playerId} added to the system.`);
}

/**
 * Gets top players ordered by a specific stat
 */
export async function getTopPlayersByStat(stat: "wins" | "goals" | "assists", limit: number = 10): Promise<PlayerStats[]> {
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
