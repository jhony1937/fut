import { room } from "./index.js";
import { supabase } from "./database.js";

export interface BanEntry {
    name: string;
    auth: string;
    reason: string;
    date: string;
}

let banList: BanEntry[] = [];

/**
 * Loads the ban list from the database.
 */
export async function loadBanList(): Promise<void> {
    try {
        const { data, error } = await supabase
            .from('bans')
            .select('*');

        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('relation "bans" does not exist')) {
                console.log("[BanList] Table 'bans' not found, using in-memory list.");
                banList = [];
                return;
            }
            throw error;
        }

        banList = data || [];
        console.log(`[BanList] Loaded ${banList.length} bans.`);
    } catch (err) {
        console.error("[BanList] Failed to load bans:", err);
        banList = [];
    }
}

/**
 * Adds a player to the ban list.
 */
export async function addBan(player: PlayerObject, reason: string): Promise<void> {
    const entry: BanEntry = {
        name: player.name,
        auth: player.auth,
        reason: reason,
        date: new Date().toISOString()
    };

    banList.push(entry);

    try {
        const { error } = await supabase
            .from('bans')
            .insert([entry]);

        if (error) throw error;
    } catch (err) {
        console.error("[BanList] Failed to save ban to DB:", err);
    }
}

/**
 * Removes a player from the ban list by name.
 */
export async function removeBan(name: string): Promise<boolean> {
    const index = banList.findIndex(b => b.name.toLowerCase() === name.toLowerCase());
    if (index === -1) return false;

    const entry = banList[index];
    if (!entry) return false;

    banList.splice(index, 1);

    try {
        const { error } = await supabase
            .from('bans')
            .delete()
            .eq('name', entry.name);

        if (error) throw error;
    } catch (err) {
        console.error("[BanList] Failed to remove ban from DB:", err);
    }

    return true;
}

/**
 * Checks if a player is banned.
 */
export function isBanned(name: string): BanEntry | undefined {
    return banList.find(b => b.name.toLowerCase() === name.toLowerCase());
}

/**
 * Gets the current ban list.
 */
export function getBanList(): BanEntry[] {
    return banList;
}

/**
 * Helper to find a player by @tag in the room (supports partial matches).
 */
export function getPlayerByTag(tag: string): PlayerObject | undefined {
    const name = tag.replace("@", "").toLowerCase();
    return room.getPlayerList().find(p => p.name.toLowerCase().includes(name));
}
