import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env['SUPABASE_URL'] || 'https://dlxanovfndvwhrlbwvmh.supabase.co';
const SUPABASE_KEY = process.env['SUPABASE_KEY'] || 'sb_secret_vm7PuS7CZl9TbdWcbS1dqQ_B_YpkDEN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function initDatabase(onPlayerUpdate?: (payload: any) => void) {
    console.log("Supabase initialized");
    
    // Realtime Channel for sync
    supabase.channel('players-sync')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, (payload) => {
            console.log('Player updated in dashboard:', payload.new);
            if (onPlayerUpdate) onPlayerUpdate(payload.new);
        })
        .subscribe();
}
