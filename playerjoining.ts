import { room, specPlayerIdList, debuggingMode, adminAuthList, redPlayerIdList, restartGameWithCallback, bluePlayerIdList } from "./index.js";
import { checkAndHandleBadWords } from "./moderation.js";
import { movePlayerToTeam, moveOneSpecToEachTeam } from "./teammanagement.js";
import { getPlayerStatsFromDB } from "./stats.js";

export async function handlePlayerJoining(player: PlayerObject): Promise<void> {
    const playerId: number = player.id;
    const playerName: string = player.name;
    const playerList: PlayerObject[] = room.getPlayerList();
    if (checkAndHandleBadWords(player, playerName)) return;
    if (adminAuthList.has(player.auth)) room.setPlayerAdmin(playerId, true);
    
    // Load player stats into cache for synchronous access (e.g. chat)
    await getPlayerStatsFromDB(playerName);
    
    // Show PlayerName joined the game to everyone in blue bold font
     room.sendAnnouncement(`${playerName} joined the game`, undefined, 0x0000FF, "bold", 0);
     
     // Welcome message for the joined player
     room.sendAnnouncement(`👋 Welcome ${playerName} to the room!`, playerId, 0x00FF00, "bold", 0);
     room.sendAnnouncement(`📜 Type !rules to see the server rules.`, playerId, 0xFFFF00, "bold", 0);
     room.sendAnnouncement(`💬 To talk in team chat press T.`, playerId, 0x00FFFF, "bold", 0);
     
    console.log(`>>> ${playerName} joined the room.`);
    checkAndRestartWithNewMode(playerList);
}

function checkAndRestartWithNewMode(playerList: PlayerObject[]): void {
    const playerListLength: number = playerList.length;
    if (playerListLength === 1) restartGameWithCallback(() => movePlayerToTeam(playerList[0]!.id, redPlayerIdList));
    if (playerListLength === 2) restartGameWithCallback(() => movePlayerToTeam(specPlayerIdList[0]!, bluePlayerIdList));
    if (playerListLength <= 6 && specPlayerIdList.length === 2) restartGameWithCallback(() => moveOneSpecToEachTeam());
}
