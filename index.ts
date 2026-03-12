import HaxballJS from "haxball.js";
import * as fs from "fs";
import { handlePlayerActivity, checkAndHandleInactivePlayers } from "./afkdetection.js";
import { handlePlayerJoining } from "./playerjoining.js";
import { handlePlayerLeaving } from "./playerleaving.js";
import { handleTeamWin } from "./teammanagement.js";
import { checkAndHandleBadWords, checkAndHandleSpam } from "./moderation.js";
import { checkAndHandleCommands } from "./commands.js";

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

export let room: RoomObject;

HaxballJS.then((HBInit) => {
  room = HBInit({
    roomName: "⚖️ FUTSAL Testing ⚖️",
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
    handlePlayerJoining(player);
  }

  room.onPlayerLeave = function (player: PlayerObject): void {
    handlePlayerLeaving(player);
  }

  room.onTeamGoal = function (teamId: number) {
    const scores = room.getScores();
    const teamScore = teamId === 1 ? scores.red : scores.blue;
    const teamPlayerIdList = teamId === 1 ? redPlayerIdList : bluePlayerIdList;
    if (teamScore === scoreLimit || scores.time > timeLimit * 60) restartGameWithCallback(() => handleTeamWin(teamPlayerIdList));
  }

  //triggers *only* when a team is winning and the timer runs out, 
  //because the room is also listening for the onTeamGoal event, which triggers first
  room.onTeamVictory = function (scores: ScoresObject): void {
    const teamPlayerIdList = scores.red > scores.blue ? redPlayerIdList : bluePlayerIdList;
    restartGameWithCallback(() => handleTeamWin(teamPlayerIdList));
  }

  room.onPlayerActivity = function (player: PlayerObject): void {
    handlePlayerActivity(player.id);
  }

  room.onGameTick = function (): void {
    if (!debuggingMode) checkAndHandleInactivePlayers();
  }

  room.onPlayerChat = function (player: PlayerObject, message: string): boolean {
    console.log(`${player.name}: ${message}`);
    return !checkAndHandleCommands(player, message) && !checkAndHandleBadWords(player, message) && !checkAndHandleSpam(player, message);
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
