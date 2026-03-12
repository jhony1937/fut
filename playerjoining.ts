import { room, specPlayerIdList, debuggingMode, playerConnStrings, adminAuthList, redPlayerIdList, restartGameWithCallback, bluePlayerIdList } from "./index.js";
import { checkAndHandleBadWords } from "./moderation.js";
import { movePlayerToTeam, moveOneSpecToEachTeam } from "./teammanagement.js";
import { getPlayerStats, getRankObject } from "./stats.js";

export function handlePlayerJoining(player: PlayerObject): void {
    const playerId: number = player.id;
    const playerName: string = player.name;
    const playerList: PlayerObject[] = room.getPlayerList();
    if (checkAndHandleBadWords(player, playerName)) return;
    if (isPlayerAlreadyConnected(player, player.conn)) return;
    if (adminAuthList.has(player.auth)) room.setPlayerAdmin(playerId, true);
    
    // Get stats and rank for join message
    const stats = getPlayerStats(player);
    const rank = getRankObject(stats.wins);
    
    // Show [Rank] PlayerName joined the game to everyone
    room.sendAnnouncement(`[${rank.name}] ${playerName} joined the game`, undefined, rank.color, "bold", 0);
    
    specPlayerIdList.push(playerId);
    console.log(`>>> ${playerName} joined the room.`);
    checkAndRestartWithNewMode(playerList);
}

function checkAndRestartWithNewMode(playerList: PlayerObject[]): void {
    const playerListLength: number = playerList.length;
    if (playerListLength === 1) restartGameWithCallback(() => movePlayerToTeam(playerList[0]!.id, redPlayerIdList));
    if (playerListLength === 2) restartGameWithCallback(() => movePlayerToTeam(specPlayerIdList[0]!, bluePlayerIdList));
    if (playerListLength <= 6 && specPlayerIdList.length === 2) restartGameWithCallback(() => moveOneSpecToEachTeam());
}

function isPlayerAlreadyConnected(player: PlayerObject, conn: string): boolean {
    const playerId = player.id;
    if (!debuggingMode && [...playerConnStrings.values()].some(value => value === conn)) {
        room.kickPlayer(playerId, "You are already connected to the room", false);
        console.warn(`>>> ${player.name} was kicked. Reason: connecting twice with the same IP.`);
        return true;
    }
    playerConnStrings.set(playerId, conn);
    return false;
}
