import { room, redPlayerIdList, bluePlayerIdList } from "./index.js";
import { getQueueList, getSpectatorByIndex } from "./spectatorQueue.js";
import { movePlayerToTeam } from "./teammanagement.js";

export let isPicking = false;

/**
 * Sets the picking state
 */
export function setPickingState(state: boolean): void {
    isPicking = state;
}

/**
 * Displays the current spectator list with numbers
 */
export function displaySpectators(targetPlayerId?: number): void {
    const specs = getQueueList();
    if (specs.length === 0) {
        room.sendAnnouncement("📢 No spectators waiting.", targetPlayerId, 0xFFFF00, "bold");
        return;
    }

    room.sendAnnouncement("📋 --- SPECTATORS LIST --- 📋", targetPlayerId, 0x00FFFF, "bold");
    specs.forEach((spec, index) => {
        const prefix = index === 0 ? "⭐️ [Reserved] " : `${index + 1}. `;
        room.sendAnnouncement(`${prefix}${spec.name}`, targetPlayerId, 0xFFFFFF, "normal");
    });
    
    if (isPicking) {
        room.sendAnnouncement("👆 Admins: Type a number to choose a player!", targetPlayerId, 0x00FF00, "bold");
    }
}

/**
 * Handles number-based selection in chat
 */
export function handleCaptainPick(player: PlayerObject, message: string): boolean {
    if (!isPicking) return false;
    if (!player.admin) return false;

    const index = parseInt(message.trim());
    if (isNaN(index)) return false;

    const target = getSpectatorByIndex(index);
    if (!target) {
        room.sendAnnouncement(`⚠️ No spectator found at number ${index}.`, player.id, 0xFF0000, "normal");
        return true; // Suppress invalid number from chat
    }

    // Move to the team with fewer players
    const targetTeam = redPlayerIdList.length <= bluePlayerIdList.length ? redPlayerIdList : bluePlayerIdList;
    movePlayerToTeam(target.id, targetTeam);
    room.sendAnnouncement(`✅ ${target.name} was chosen and moved to ${targetTeam === redPlayerIdList ? "Red" : "Blue"}.`, undefined, 0x00FF00, "bold");

    // Update and re-display the list
    displaySpectators();
    
    return true; // Suppress valid selection from chat
}

/**
 * Handles picking state when a player leaves
 */
export function handlePlayerLeavePick(_player: PlayerObject): void {
    if (isPicking) {
        displaySpectators();
    }
}
