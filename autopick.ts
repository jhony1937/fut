import { room } from "./index.js";
import { getQueueList, getSpectatorByIndex } from "./spectatorQueue.js";
import { movePlayerToTeam, checkAutoStart } from "./teammanagement.js";

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
    const redCount = room.getPlayerList().filter(p => p.team === 1).length;
    const blueCount = room.getPlayerList().filter(p => p.team === 2).length;
    const targetTeamId = redCount <= blueCount ? 1 : 2;
    
    movePlayerToTeam(target.id, targetTeamId);
    room.sendAnnouncement(`✅ ${target.name} was chosen and moved to ${targetTeamId === 1 ? "Red" : "Blue"}.`, undefined, 0x00FF00, "bold");

    // Update and re-display the list
    displaySpectators();
    
    // Check if teams are now balanced and can start
    checkAutoStart();
    
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
