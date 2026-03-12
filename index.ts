import HaxballJS from "haxball.js";
import * as fs from "fs";
import { handlePlayerActivity, checkAndHandleInactivePlayers } from "./afkdetection.js";
import { handlePlayerJoining } from "./playerjoining.js";
import { handlePlayerLeaving } from "./playerleaving.js";
import { handleTeamWin } from "./teammanagement.js";
import { checkAndHandleBadWords, checkAndHandleSpam } from "./moderation.js";
import { checkAndHandleCommands } from "./commands.js";
import { playerNames, getPlayerStats, updatePlayerStats, getRankObject } from "./stats.js";

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

HaxballJS.then((HBInit) => {
  room = HBInit({
    roomName: "⚖️ FUTSAL Testing ⚖️",
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
  room.setCustomStadium(practiceStadium);

  room.onRoomLink = function (url: string) {
    console.log(url);
  };

  room.onPlayerJoin = function (player: PlayerObject): void {
    // Store player name for leaderboard persistence
    playerNames.set(player.auth, player.name);
    // Initialize stats if not exists
    getPlayerStats(player);
    handlePlayerJoining(player);
  }

  room.onPlayerLeave = function (player: PlayerObject): void {
    handlePlayerLeaving(player);
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

  room.onTeamGoal = function (teamId: number) {
    // Update goal and assist stats
    if (lastBallTouch && lastBallTouch.team === teamId) {
      updatePlayerStats(lastBallTouch.auth, { goals: 1 });
      room.sendAnnouncement(`⚽ Goal by ${lastBallTouch.name}!`, undefined, 0xFFFF00, "bold", 0);
      
      if (secondLastBallTouch && secondLastBallTouch.team === teamId && secondLastBallTouch.id !== lastBallTouch.id) {
        updatePlayerStats(secondLastBallTouch.auth, { assists: 1 });
        room.sendAnnouncement(`👟 Assist by ${secondLastBallTouch.name}!`, undefined, 0xFFFF00, "bold", 0);
      }
    }
    // Reset touches after goal
    lastBallTouch = null;
    secondLastBallTouch = null;

    const scores = room.getScores();
    const teamScore = teamId === 1 ? scores.red : scores.blue;
    const teamPlayerIdList = teamId === 1 ? redPlayerIdList : bluePlayerIdList;
    if (teamScore === scoreLimit || scores.time > timeLimit * 60) {
      handleMatchEnd(teamId === 1 ? 1 : 2);
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

  function handleMatchEnd(winningTeam: number) {
    const players = room.getPlayerList();
    players.forEach(p => {
      if (p.team !== 0) { // If player was in a team (Red or Blue)
        updatePlayerStats(p.auth, { matchesPlayed: 1 });
        if (p.team === winningTeam) {
          updatePlayerStats(p.auth, { wins: 1 });
        }
      }
    });
  }

  room.onGameStart = function (): void {
    lastBallTouch = null;
    secondLastBallTouch = null;
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
    
    // Check if message is a command, bad word or spam
    const handled = checkAndHandleCommands(player, message) || checkAndHandleBadWords(player, message) || checkAndHandleSpam(player, message);
    if (handled) return false; // Suppress default chat

    // Custom chat display with rank
    const stats = getPlayerStats(player);
    const rank = getRankObject(stats.wins);
    room.sendAnnouncement(`[${rank.name}] ${player.name}: ${message}`, undefined, rank.color, "normal", 0);
    
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
