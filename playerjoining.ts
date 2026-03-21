import { room, adminAuthList } from "./index.js";
import { getPlayerStatsFromDB } from "./stats.js";
import { checkAndHandleBadWords } from "./moderation.js";
import { autoAssignToTeam, applyPlayerCountLogic } from "./teammanagement.js";
import { setPickTimeout } from "./afkdetection.js";

export async function handlePlayerJoining(player: PlayerObject): Promise<void> {
    const playerId: number = player.id;
    const playerName: string = player.name;
    
    if (checkAndHandleBadWords(player, playerName)) return;
    if (adminAuthList.has(player.auth)) room.setPlayerAdmin(playerId, true);
    
    // Load player stats into cache
    await getPlayerStatsFromDB(playerName);
    
    // Set 10s pick timeout for new players
    setPickTimeout(playerId);
    
    // Announcement and welcome
    room.sendAnnouncement(`${playerName} joined the game`, undefined, 0x0000FF, "bold", 0);
    room.sendAnnouncement(`👋 Welcome ${playerName} to the room!`, playerId, 0x00FF00, "bold", 0);
    room.sendAnnouncement(`📜 Type !rules to see the server rules.`, playerId, 0xFFFF00, "bold", 0);
    
    console.log(`>>> ${playerName} joined the room.`);
    
    // Auto-join if there is space in teams (3x3 limit)
    const assigned = autoAssignToTeam(playerId);
    if (!assigned) {
        room.sendAnnouncement("📋 Teams are full (3x3), you are in spectators.", playerId, 0xFFFF00, "normal");
    } else {
        // Check if we can start the match based on total players
        applyPlayerCountLogic();
    }
}
