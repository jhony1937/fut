// @ts-nocheck
// Haxball Headless Bot with Supabase Integration
// Requirements: players table (id, name unique, goals, assists, wins, rank)

const SUPABASE_URL = 'https://dlxanovfndvwhrlbwvmh.supabase.co';
const SUPABASE_KEY = 'sb_secret_vm7PuS7CZl9TbdWcbS1dqQ_B_YpkDEN';
const ROOM_TOKEN = 'thr1.AAAAAGm6JKBEMxeKI9td2w.6gO-UedTXDk';

// This script is designed to be run in a browser environment (headless host)
// You need to include the Supabase JS library first if not using a bundler.
// For the headless host, you can inject it or use a version that bundles it.

// For the sake of "ready to paste", we'll assume the environment has access to Supabase.
// If you are using the Haxball Headless Host website, you can use:
// import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const { createClient } = window.supabase; // Standard way if script is loaded via CDN in browser
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- REALTIME CHANNEL ---
// This allows the bot to sync changes made directly in the Supabase dashboard
supabase.channel('players-sync')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, (payload) => {
    console.log('Syncing player from dashboard:', payload.new);
    // If you have a local cache, update it here
  })
  .subscribe();

const RANKS = [
  { name: 'Champion', wins: 120 },
  { name: 'Diamond III', wins: 100 },
  { name: 'Diamond II', wins: 90 },
  { name: 'Diamond I', wins: 80 },
  { name: 'Platinum III', wins: 70 },
  { name: 'Platinum II', wins: 60 },
  { name: 'Platinum I', wins: 50 },
  { name: 'Gold III', wins: 45 },
  { name: 'Gold II', wins: 40 },
  { name: 'Gold I', wins: 35 },
  { name: 'Silver III', wins: 30 },
  { name: 'Silver II', wins: 25 },
  { name: 'Silver I', wins: 20 },
  { name: 'Bronze III', wins: 15 },
  { name: 'Bronze II', wins: 10 },
  { name: 'Bronze I', wins: 5 },
  { name: 'Unranked', wins: 0 }
];

function getRankByWins(wins) {
  for (const rank of RANKS) {
    if (wins >= rank.wins) return rank.name;
  }
  return 'Unranked';
}

const room = window.HBInit({
  roomName: "Haxball Supabase Bot",
  maxPlayers: 16,
  public: true,
  noPlayer: true,
  token: ROOM_TOKEN
});

let lastBallTouch = null;
let penultimateBallTouch = null;

// Ball touch detection constants
const BALL_RADIUS = 10;
const PLAYER_RADIUS = 15;
const TRIGGER_DISTANCE = BALL_RADIUS + PLAYER_RADIUS + 2;

// --- DATABASE HELPERS ---
async function getPlayerFromDB(name) {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('name', name)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (err) {
    return null;
  }
}

async function registerPlayer(name) {
  try {
    const { data, error } = await supabase
      .from('players')
      .insert([{ name, goals: 0, assists: 0, wins: 0, rank: 'Unranked' }])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    return null;
  }
}

async function updatePlayerStats(name, stats) {
  try {
    await supabase.from('players').update(stats).eq('name', name);
  } catch (err) {
    console.error(err);
  }
}

// --- ROOM EVENTS ---
room.onPlayerJoin = async (player) => {
  let dbPlayer = await getPlayerFromDB(player.name);
  if (!dbPlayer) {
    await registerPlayer(player.name);
  }
};

room.onGameTick = () => {
  const ball = room.getBallPosition();
  if (!ball) return;

  const players = room.getPlayerList().filter(p => p.team !== 0);
  for (const player of players) {
    if (!player.position) continue;
    const dx = player.position.x - ball.x;
    const dy = player.position.y - ball.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= TRIGGER_DISTANCE) {
      if (lastBallTouch && lastBallTouch.id !== player.id) {
        penultimateBallTouch = lastBallTouch;
      }
      lastBallTouch = player;
    }
  }
};

room.onTeamGoal = async (team) => {
  if (!lastBallTouch) return;

  const scorer = lastBallTouch;
  const assist = (penultimateBallTouch && penultimateBallTouch.team === scorer.team && penultimateBallTouch.id !== scorer.id) ? penultimateBallTouch : null;

  const scorerData = await getPlayerFromDB(scorer.name);
  if (scorerData) {
    await updatePlayerStats(scorer.name, { goals: scorerData.goals + 1 });
  }

  let announcement = `⚽ GOAL by ${scorer.name}`;
  if (assist) {
    const assistData = await getPlayerFromDB(assist.name);
    if (assistData) {
      await updatePlayerStats(assist.name, { assists: assistData.assists + 1 });
    }
    announcement += ` (+assist: ${assist.name})`;
  }
  room.sendAnnouncement(announcement, null, 0xFFFF00, "bold");

  lastBallTouch = null;
  penultimateBallTouch = null;
};

room.onTeamVictory = async (scores) => {
  const winningTeamId = scores.red > scores.blue ? 1 : 2;
  const players = room.getPlayerList();

  for (const player of players) {
    if (player.team === winningTeamId) {
      const dbPlayer = await getPlayerFromDB(player.name);
      if (dbPlayer) {
        const newWins = dbPlayer.wins + 1;
        const newRank = getRankByWins(newWins);
        const updates = { wins: newWins, rank: dbPlayer.rank };
        
        if (newRank !== dbPlayer.rank) {
          updates.rank = newRank;
          room.sendAnnouncement(`🔥 ${player.name} ranked up to ${newRank}`, null, 0xFFA500, "bold");
        }
        await updatePlayerStats(player.name, updates);
      }
    }
  }
};

room.onPositionsReset = () => {
  lastBallTouch = null;
  penultimateBallTouch = null;
};

room.onPlayerChat = async (player, message) => {
  if (!message.startsWith('!')) return;

  const command = message.split(' ')[0].toLowerCase();
  const dbPlayer = await getPlayerFromDB(player.name);
  if (!dbPlayer) return false;

  switch (command) {
    case '!stats':
      room.sendAnnouncement(`📊 Stats for ${player.name}: Goals: ${dbPlayer.goals} | Assists: ${dbPlayer.assists} | Wins: ${dbPlayer.wins} | Rank: ${dbPlayer.rank}`, player.id);
      break;
    case '!wins':
      room.sendAnnouncement(`🏆 Wins: ${dbPlayer.wins} | Rank: ${dbPlayer.rank}`, player.id);
      break;
    case '!goals':
      room.sendAnnouncement(`⚽ Goals: ${dbPlayer.goals}`, player.id);
      break;
    case '!assists':
      room.sendAnnouncement(`👟 Assists: ${dbPlayer.assists}`, player.id);
      break;
  }
  return false;
};
