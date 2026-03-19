import HaxballJS from "haxball.js";
import * as fs from "fs";
import { handlePlayerActivity, checkAndHandleInactivePlayers } from "./afkdetection.js";
import { handlePlayerJoining } from "./playerjoining.js";
import { handlePlayerLeaving } from "./playerleaving.js";
import { handleTeamWin } from "./teammanagement.js";
import { checkAndHandleBadWords, checkAndHandleSpam } from "./moderation.js";
import { checkAndHandleCommands, isCommand } from "./commands.js";
import { playerNames, incrementGoals, incrementAssists, incrementWin, getRankObjectByName, playerStatsCache, addPlayerToIKnow } from "./stats.js";
import { initDatabase } from "./database.js";
import { isPicking, handleCaptainPick, handlePlayerLeavePick, setPickingState } from "./autopick.js";

import { addToQueue, removeFromQueue } from "./spectatorQueue.js";

export const debuggingMode = false;
const scoreLimit: number = 3;
const timeLimit: number = 3;

export const playerConnStrings = new Map<number, string>();
export const adminAuthList: Set<string> = new Set(fs.readFileSync("lists/adminlist.txt", "utf8").split("\n").map((line: string) => line.trim()));
export const badWordList: Set<string> = new Set(fs.readFileSync("lists/badwords.txt", "utf8").split("\n").map((line: string) => line.trim()));
const tokenFile: string = process.env['HAXBALL_TOKEN'] || fs.readFileSync("token.txt", "utf8");
const practiceStadium: string = fs.readFileSync("stadiums/practice.hbs", "utf8");
const stadium2x2: string = fs.readFileSync("stadiums/futsal2x2.hbs", "utf8");
const stadium3x3: string = fs.readFileSync("stadiums/futsal3x3.hbs", "utf8");

export let specPlayerIdList: number[] = [];
export let redPlayerIdList: number[] = [];
export let bluePlayerIdList: number[] = [];

// New: variables to track last ball touches for goals and assists
let lastBallTouch: PlayerObject | null = null;
let secondLastBallTouch: PlayerObject | null = null;

export let room: RoomObject;

HaxballJS.then(async (HBInit) => {
  await initDatabase((updatedPlayer) => {
    // Sync local cache with dashboard edits
    if (updatedPlayer && updatedPlayer.name) {
      playerStatsCache.set(updatedPlayer.name, updatedPlayer);
      console.log(`[Sync] Dashboard update for ${updatedPlayer.name} applied to bot cache.`);
    }
  });
  room = HBInit({
    roomName: "Futsal|3V3|Testing|vbeta",
    maxPlayers: 20,
    public: true,
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
  room.setCustomStadium(practiceStadium);

  room.onRoomLink = function (url: string) {
    console.log(url);
  };

  room.onPlayerJoin = function (player: PlayerObject): void {
    // Store player name for leaderboard persistence
    playerNames.set(player.auth, player.name);
    // Initialize stats from database if not exists
    handlePlayerJoining(player);
    addToQueue(player.id);
  }

  room.onPlayerLeave = function (player: PlayerObject): void {
    handlePlayerLeaving(player);
    handlePlayerLeavePick(player);
    removeFromQueue(player.id);
  }

  room.onPlayerTeamChange = function (changedPlayer: PlayerObject, _byPlayer: PlayerObject): void {
     if (changedPlayer.team === 0) {
         addToQueue(changedPlayer.id);
         if (!specPlayerIdList.includes(changedPlayer.id)) specPlayerIdList.push(changedPlayer.id);
         const redIndex = redPlayerIdList.indexOf(changedPlayer.id);
         if (redIndex !== -1) redPlayerIdList.splice(redIndex, 1);
         const blueIndex = bluePlayerIdList.indexOf(changedPlayer.id);
         if (blueIndex !== -1) bluePlayerIdList.splice(blueIndex, 1);
     } else if (changedPlayer.team === 1) {
         removeFromQueue(changedPlayer.id);
         if (!redPlayerIdList.includes(changedPlayer.id)) redPlayerIdList.push(changedPlayer.id);
         const specIndex = specPlayerIdList.indexOf(changedPlayer.id);
         if (specIndex !== -1) specPlayerIdList.splice(specIndex, 1);
         const blueIndex = bluePlayerIdList.indexOf(changedPlayer.id);
         if (blueIndex !== -1) bluePlayerIdList.splice(blueIndex, 1);
     } else if (changedPlayer.team === 2) {
         removeFromQueue(changedPlayer.id);
         if (!bluePlayerIdList.includes(changedPlayer.id)) bluePlayerIdList.push(changedPlayer.id);
         const specIndex = specPlayerIdList.indexOf(changedPlayer.id);
         if (specIndex !== -1) specPlayerIdList.splice(specIndex, 1);
         const redIndex = redPlayerIdList.indexOf(changedPlayer.id);
         if (redIndex !== -1) redPlayerIdList.splice(redIndex, 1);
     }
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
    const ballProps = room.getDiscProperties(0);
    const speed = ballProps ? Math.sqrt(ballProps.xspeed * ballProps.xspeed + ballProps.yspeed * ballProps.yspeed) * 100 : 0;
    const speedFormatted = Math.round(speed);

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
    room.sendAnnouncement("GOAL ⚽", undefined, 0xFFFF00, "bold", 0);
    room.sendAnnouncement(`Scorer: ${scorerName}`, undefined, 0xFFFF00, "bold", 0);
    room.sendAnnouncement(`Assist: ${assistantName}`, undefined, 0xFFFF00, "bold", 0);
    room.sendAnnouncement(`Speed: ${speedFormatted} km/h`, undefined, 0xFFFF00, "bold", 0);

    // Reset touches after goal
    lastBallTouch = null;
    secondLastBallTouch = null;

    const scores = room.getScores();
    const teamScore = teamId === 1 ? scores.red : scores.blue;
    const teamPlayerIdList = teamId === 1 ? redPlayerIdList : bluePlayerIdList;
    if (teamScore === scoreLimit || scores.time > timeLimit * 60) {
      await handleMatchEnd(teamId === 1 ? 1 : 2);
      restartGameWithCallback(() => handleTeamWin(teamPlayerIdList));
    }
  }

  //triggers *only* when a team is winning and the timer runs out, 
  //because the room is also listening for the onTeamGoal event, which triggers first
  room.onTeamVictory = function (scores: ScoresObject): void {
    const winningTeam = scores.red > scores.blue ? 1 : 2;
    handleMatchEnd(winningTeam);
    const teamPlayerIdList = winningTeam === 1 ? redPlayerIdList : bluePlayerIdList;
    restartGameWithCallback(() => handleTeamWin(teamPlayerIdList));
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
  }

  room.onPositionsReset = function (): void {
    lastBallTouch = null;
    secondLastBallTouch = null;
  }

  room.onPlayerActivity = function (player: PlayerObject): void {
    handlePlayerActivity(player.id);
  }

  room.onGameTick = function (): void {
    if (!debuggingMode) checkAndHandleInactivePlayers();
    checkBallTouch();
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

    // Custom chat display with rank using synchronous cache
    const stats = playerStatsCache.get(player.name);
    const rankName = stats ? stats.rank : "Unranked";
    const rankObj = getRankObjectByName(rankName);
    
    // Default bold for all
    const fontWeight = "bold";
    
    room.sendAnnouncement(`[${rankObj.name}] ${player.name}: ${message}`, undefined, rankObj.color, fontWeight, 0);
    
    return false; // Suppress default chat
  }
});

export function restartGameWithCallback(callback: () => void): void {
  room.stopGame();
  callback();
  setAppropriateStadium();
  room.startGame();
  const playerList: PlayerObject[] = room.getPlayerList();
  if (playerList.length !== 1) pauseUnpauseGame();
}

function setAppropriateStadium() {
  const playerList = room.getPlayerList();
  const playerListLength = playerList.length;
  if (playerListLength === 1) {
    room.setCustomStadium(practiceStadium);
  } else if (playerListLength >= 6) {
    room.setCustomStadium(stadium3x3);
  } else {
    room.setCustomStadium(stadium2x2);
  }
}

export function pauseUnpauseGame() {
  room.pauseGame(true);
  room.pauseGame(false);
}
