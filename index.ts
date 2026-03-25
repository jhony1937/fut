import HaxballJS from "haxball.js";
import * as fs from "fs";
import { handlePlayerActivity, checkAndHandleInactivePlayers, resetAllActivityTimestamps, setGracePeriod, handleImmunePlayerFreezing } from "./afkdetection.js";
import { handlePlayerJoining } from "./playerjoining.js";
import { handlePlayerLeaving } from "./playerleaving.js";
import { handleTeamWin, applyPlayerCountLogic } from "./teammanagement.js";
import { checkAndHandleBadWords, checkAndHandleSpam, styleMessage } from "./moderation.js";
import { checkAndHandleCommands, isCommand } from "./commands.js";
import { playerNames, incrementGoals, incrementAssists, incrementWin, getRankObjectByName, playerStatsCache, addPlayerToIKnow } from "./stats.js";
import { initDatabase } from "./database.js";
import { isPicking, handleCaptainPick, handlePlayerLeavePick, setPickingState } from "./autopick.js";

import { addToQueue, removeFromQueue } from "./spectatorQueue.js";

export const debuggingMode = false;
const scoreLimit: number = 3;
const timeLimit: number = 3;

/**
 * Helper to load a list from a file safely.
 */
function loadListFile(path: string): Set<string> {
  try {
    if (fs.existsSync(path)) {
      return new Set(fs.readFileSync(path, "utf8").split("\n").map((line: string) => line.trim()).filter(line => line.length > 0));
    }
  } catch (err) {
    console.error(`[Error] Failed to load list file: ${path}`, err);
  }
  return new Set<string>();
}

export const adminAuthList: Set<string> = loadListFile("lists/adminlist.txt");
export const immuneAuthList: Set<string> = loadListFile("lists/immunelist.txt");
export const badWordList: Set<string> = loadListFile("lists/badwords.txt");

const tokenFile: string = process.env['HAXBALL_TOKEN'] || (fs.existsSync("token.txt") ? fs.readFileSync("token.txt", "utf8") : "");
const smallStadium: string = fs.readFileSync("stadiums/small.hbs", "utf8");
const mediumStadium: string = fs.readFileSync("stadiums/medium.hbs", "utf8");
const bigStadium: string = fs.readFileSync("stadiums/big.hbs", "utf8");

// Map stadium names to content for comparison and easy access
const stadiums: { [key: string]: string } = {
  "1v1": smallStadium,
  "2v2": mediumStadium,
  "3v3": bigStadium
};

let currentStadiumName: string = "1v1";
let stadiumChangeTimeout: NodeJS.Timeout | null = null;

// Win streaks for each team
let redStreak: number = 0;
let blueStreak: number = 0;

/**
 * Checks if a stadium change is currently scheduled.
 */
export function isStadiumChangePending(): boolean {
  return stadiumChangeTimeout !== null;
}

// New: variables to track last ball touches for goals and assists
let lastBallTouch: PlayerObject | null = null;
let secondLastBallTouch: PlayerObject | null = null;

// Accurate Ball Tracking for Goal Speed (km/h)
let lastBallX: number = 0;
let lastBallY: number = 0;
let lastBallTime: number = 0;
let lastValidSpeedKmh: number = 0;
const MAX_SPEED_KMH = 120; // Clamp unrealistic speeds
const SPEED_FILTER_THRESHOLD = 0.05; // Ignore tiny movements (noise)

/**
 * Tracks ball movement and calculates speed in km/h.
 * Called on every game tick for accuracy.
 */
function updateBallSpeedTracking(): void {
  const ballPos = room.getBallPosition();
  if (!ballPos) return;

  const now = Date.now();
  if (lastBallTime > 0) {
    const dt = (now - lastBallTime) / 1000; // time in seconds
    if (dt > 0) {
      const dx = ballPos.x - lastBallX;
      const dy = ballPos.y - lastBallY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Filter out micro-movements (noise/lag)
      if (distance > SPEED_FILTER_THRESHOLD) {
        // Speed Calculation: distance / time
        // Calibration: factor to convert units/sec to realistic km/h
        // (Approx 0.45 is a common realistic factor for standard maps)
        let speed = (distance / dt) * 0.45;

        // Apply clamping (max 120 km/h)
        if (speed > MAX_SPEED_KMH) speed = MAX_SPEED_KMH;

        // Use a simple moving average for stability (30% new speed, 70% old)
        // This prevents spikes from single-tick teleports or lag.
        lastValidSpeedKmh = lastValidSpeedKmh * 0.7 + speed * 0.3;
      }
    }
  }

  // Store for next tick
  lastBallX = ballPos.x;
  lastBallY = ballPos.y;
  lastBallTime = now;
}

export let room: RoomObject;
export { getPlayerStatsFromDB } from "./stats.js";

HaxballJS.then(async (HBInit) => {
  await initDatabase((updatedPlayer) => {
    // Sync local cache with dashboard edits
    if (updatedPlayer && updatedPlayer.name) {
      playerStatsCache.set(updatedPlayer.name, updatedPlayer);
      console.log(`[Sync] Dashboard update for ${updatedPlayer.name} applied to bot cache.`);
    }
  });
  room = HBInit({
    roomName: "🟨​Futsal|3v3|Ranked|Testing🟨​",
    maxPlayers: 20,
    public: false,
    noPlayer: true,
    geo: {
      code: "MA",
      lat: 33.5731,
      lon: -7.5898
    },
    token: tokenFile, //https://haxball.com/headlesstoken
  });

  room.setScoreLimit(scoreLimit);
  room.setTimeLimit(timeLimit);
  room.setTeamsLock(true);
  room.setCustomStadium(smallStadium);
  applyTeamColors(); // Set default colors initially

  room.onRoomLink = function (url: string) {
    console.log(url);
  };

  room.onPlayerJoin = function (player: PlayerObject): void {
    // Store player name for leaderboard persistence
    playerNames.set(player.auth, player.name);
    // Initialize stats from database if not exists
    handlePlayerJoining(player);
    addToQueue(player.id);
    
    // Evaluate stadium on join
    setAppropriateStadium();
    
    // Apply auto-assignment and auto-start logic
    setTimeout(() => applyPlayerCountLogic(), 500);
  }

  room.onPlayerLeave = function (player: PlayerObject): void {
    handlePlayerLeaving(player);
    handlePlayerLeavePick(player);
    removeFromQueue(player.id);
    
    // Evaluate stadium on leave
    setAppropriateStadium();
  }

  room.onPlayerTeamChange = function (changedPlayer: PlayerObject, _byPlayer: PlayerObject): void {
     if (changedPlayer.team === 0) {
         addToQueue(changedPlayer.id);
     } else {
         removeFromQueue(changedPlayer.id);
         // Set a 45s grace period for players joining Red or Blue team
         setGracePeriod(changedPlayer.id, 45000);
     }
     setAppropriateStadium(); // Added stadium re-evaluation
     applyPlayerCountLogic();
  }

  function checkBallTouch(): void {
    const ballPos = room.getBallPosition();
    if (!ballPos) return;

    const players = room.getPlayerList().filter(p => p.team !== 0);
    for (const player of players) {
      if (!player.position) continue;
      const dx = player.position.x - ballPos.x;
      const dy = player.position.y - ballPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 28) { // 15 (player) + 10 (ball) + 3 (buffer)
        if (lastBallTouch?.id !== player.id) {
          secondLastBallTouch = lastBallTouch;
          lastBallTouch = player;
        }
        break; // Only one player can touch at a time
      }
    }
  }

  room.onTeamGoal = function (teamId: number): void {
    handleGoal(teamId);
  }

  async function handleGoal(teamId: number) {
    // Use the tracked peak/last valid speed from our calculation logic
    const speedFormatted = Math.round(lastValidSpeedKmh);

    let scorerName = "Unknown";
    let assistantName = "None";

    // Update goal and assist stats
    if (lastBallTouch && lastBallTouch.team === teamId) {
      scorerName = lastBallTouch.name;
      // The scorer receives +1 goal
      await incrementGoals(scorerName);
      
      // Automatically add the scoring player to the “iknow” scorer system using their player ID
      addPlayerToIKnow(lastBallTouch.id);
      
      // The player who touched the ball before the scorer receives +1 assist
      if (secondLastBallTouch && secondLastBallTouch.team === teamId && secondLastBallTouch.id !== lastBallTouch.id) {
        assistantName = secondLastBallTouch.name;
        await incrementAssists(assistantName);
      }
    }

    // Announcement
    room.sendAnnouncement("⚽ Goal!", undefined, 0xFFFF00, "bold", 0);
    room.sendAnnouncement(`👤 Scorer: ${scorerName}`, undefined, 0xFFFF00, "bold", 0);
    room.sendAnnouncement(`👟 Assist: ${assistantName}`, undefined, 0xFFFF00, "bold", 0);
    room.sendAnnouncement(`🚀 Speed: ${speedFormatted} km/h`, undefined, 0xFFFF00, "bold", 0);

    // Reset speed and touches after goal
    lastBallTouch = null;
    secondLastBallTouch = null;
    lastValidSpeedKmh = 0;
  }

  //triggers *only* when a team is winning and the timer runs out, 
  //because the room is also listening for the onTeamGoal event, which triggers first
  room.onTeamVictory = function (scores: ScoresObject): void {
    const winningTeam = scores.red > scores.blue ? 1 : 2;
    
    // Manage streaks
    if (winningTeam === 1) {
      redStreak++;
      blueStreak = 0;
      if (redStreak >= 5) {
        room.sendAnnouncement(`🏆 RED TEAM is on a 5-win streak! They are now GOLD!`, undefined, 0xFFD700, "bold", 0);
      }
    } else {
      blueStreak++;
      redStreak = 0;
      if (blueStreak >= 5) {
        room.sendAnnouncement(`🏆 BLUE TEAM is on a 5-win streak! They are now GOLD!`, undefined, 0xFFD700, "bold", 0);
      }
    }
    
    applyTeamColors(); // Update colors based on streaks

    handleMatchEnd(winningTeam);
    restartGameWithCallback(() => handleTeamWin(winningTeam));
  }

  async function handleMatchEnd(winningTeam: number) {
    const players = room.getPlayerList();
    for (const p of players) {
      if (p.team !== 0) { // If player was in a team (Red or Blue)
        if (p.team === winningTeam) {
          // Increase wins for players in the winning team.
          const { rankedUp, newRank } = await incrementWin(p.name);
          if (rankedUp) {
            room.sendAnnouncement(`🔥 ${p.name} ranked up to ${newRank}`, undefined, 0xFFA500, "bold", 0);
          }
        }
      }
    }
  }

  room.onGameStart = function (): void {
    lastBallTouch = null;
    secondLastBallTouch = null;
    setPickingState(false);
    resetAllActivityTimestamps();
  }

  room.onPositionsReset = function (): void {
    lastBallTouch = null;
    secondLastBallTouch = null;
  }

  function applyTeamColors(): void {
    // Red Team (ID 1)
    if (redStreak >= 5) {
      room.setTeamColors(1, 45, 0xFFFFFF, [0xFFD700, 0xDAA520, 0xB8860B]);
    } else {
      room.setTeamColors(1, 0, 0xC70404, [0xB8860B]); // Red main + Dark Gold secondary
    }

    // Blue Team (ID 2)
    if (blueStreak >= 5) {
      room.setTeamColors(2, 45, 0xFFFFFF, [0xFFD700, 0xDAA520, 0xB8860B]);
    } else {
      room.setTeamColors(2, 0, 0x0B0761, [0xB8860B]); // Blue main + Dark Gold secondary
    }
  }

  room.onPlayerActivity = function (player: PlayerObject): void {
    handlePlayerActivity(player.id);
  }

  room.onGameTick = function (): void {
    if (!debuggingMode) checkAndHandleInactivePlayers();
    handleImmunePlayerFreezing();
    checkBallTouch();
    updateBallSpeedTracking();
  }

  room.onPlayerChat = function (player: PlayerObject, message: string): boolean {
    console.log(`${player.name}: ${message}`);
    
    const lowerMsg = message.toLowerCase();

    // Team Chat System: If message starts with "t "
    if (lowerMsg.startsWith("t ")) {
      const teamMsg = message.substring(2).trim();
      if (teamMsg.length > 0) {
        const playerTeam = player.team;
        const teamPlayers = room.getPlayerList().filter(p => p.team === playerTeam);
        
        let prefix = "";
        let color = 0xFFFFFF; // Default white

        if (playerTeam === 1) { // RED TEAM
          prefix = "[TEAM RED]";
          color = 0xFF3333; // Vivid Red Roi
        } else if (playerTeam === 2) { // BLUE TEAM
          prefix = "[TEAM BLUE]";
          color = 0x3366FF; // Vivid Blue Roi
        } else { // SPECTATORS
          prefix = "[SPEC]";
          color = 0xFFFFFF; // White
        }

        teamPlayers.forEach(tp => {
          room.sendAnnouncement(`${prefix} ${player.name}: ${teamMsg}`, tp.id, color, "bold", 0);
        });
        return false; // Suppress from global chat
      }
    }

    // Commands are async but must be handled immediately in terms of chat visibility
    if (isCommand(message)) {
      checkAndHandleCommands(player, message);
      return false; // Suppress command from chat
    }

    // Check bad words/spam (assuming synchronous)
    if (checkAndHandleBadWords(player, message) || checkAndHandleSpam(player, message)) {
      return false;
    }

    // Auto-pick system: if pick is in progress
    if (isPicking) {
      const pickHandled = handleCaptainPick(player, message);
      if (pickHandled) return false; // Suppress pick from chat
    }

    // Apply styled text and emojis
    const styledMessage = styleMessage(message);

    // Custom chat display with rank using synchronous cache
    const stats = playerStatsCache.get(player.name.trim());
    const rankName = stats ? stats.rank : "Unranked";
    const rankObj = getRankObjectByName(rankName);
    
    // Default bold for all
    const fontWeight = "bold";
    
    room.sendAnnouncement(`[${rankObj.name}] ${player.name}: ${styledMessage}`, undefined, rankObj.color, fontWeight, 0);
    
    return false; // Suppress default chat
  }
});

export function restartGameWithCallback(callback: () => void): void {
  room.stopGame();
  callback();
  
  // setAppropriateStadium will handle the start if a change is needed
  setAppropriateStadium();
  
  // If NO stadium change is pending, we can start the game here
  // We wait a tiny bit to see if setAppropriateStadium set a timeout
  setTimeout(() => {
    if (!stadiumChangeTimeout && !isPicking) {
      room.startGame();
      const playerList: PlayerObject[] = room.getPlayerList();
      if (playerList.length !== 1) pauseUnpauseGame();
    }
  }, 100);
}

function setAppropriateStadium() {
  // Recalculate the target stadium based on players currently in teams
  const playersInTeams = room.getPlayerList().filter(p => p.team !== 0);
  const teamPlayersCount = playersInTeams.length;
  
  let targetStadiumName = teamPlayersCount >= 6 ? "3v3" : (teamPlayersCount >= 4 ? "2v2" : "1v1");

  // If the target stadium is already active, just clear any pending changes and return
  if (targetStadiumName === currentStadiumName) {
    if (stadiumChangeTimeout) {
      clearTimeout(stadiumChangeTimeout);
      stadiumChangeTimeout = null;
    }
    return;
  }

  // If a change is already pending for this target, don't do anything
  // But if a change is pending for a DIFFERENT target, clear it and set the new one
  if (stadiumChangeTimeout) {
    clearTimeout(stadiumChangeTimeout);
  }

  // Set a 1-second delay to stabilize the count and avoid spam
  stadiumChangeTimeout = setTimeout(() => {
    // Re-check target one last time inside timeout
    const currentPlayersInTeams = room.getPlayerList().filter(p => p.team !== 0).length;
    let finalTargetName = currentPlayersInTeams >= 6 ? "3v3" : (currentPlayersInTeams >= 4 ? "2v2" : "1v1");
    let finalMapDisplayName = finalTargetName === "3v3" ? "Big (3v3)" : (finalTargetName === "2v2" ? "Medium (2v2)" : "Small (1v1)");

    if (finalTargetName !== currentStadiumName) {
      const stadiumContent = stadiums[finalTargetName];
      if (stadiumContent) {
        const scores = room.getScores();
        const isGameRunning = scores !== null;

        if (isGameRunning) {
          room.stopGame();
        }

        room.setCustomStadium(stadiumContent);
        currentStadiumName = finalTargetName;
        room.sendAnnouncement(`🏟️ Map changed to: ${finalMapDisplayName}`, undefined, 0x00FF00, "bold", 0);
        
        // After stadium change, we always ensure teams are balanced and try to start
        applyPlayerCountLogic();
      }
    }
    stadiumChangeTimeout = null;
  }, 1000);
}

export function pauseUnpauseGame() {
  room.pauseGame(true);
  room.pauseGame(false);
}
