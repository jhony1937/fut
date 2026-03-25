import { removePlayerFromAfkMapsAndSets, removePlayerAfk } from "./afkdetection.js";
import { room } from "./index.js";
import { applyPlayerCountLogic } from "./teammanagement.js";

export function handlePlayerLeaving(player: PlayerObject): void {
    const playerList = room.getPlayerList();
    
    removePlayerFromAfkMapsAndSets(player.id);
    removePlayerAfk(player.id); // Ensure AFK status is cleared when leaving
    
    if (playerList.length === 0) {
        room.stopGame();
    } else {
        applyPlayerCountLogic();
    }
    
    console.log(`>>> ${player.name} left the room.`);
}

