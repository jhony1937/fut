import { room, redPlayerIdList, bluePlayerIdList, specPlayerIdList } from "./index.js";
import { movePlayerToTeam } from "./teammanagement.js";

export let isPicking = false;
export let redCaptain: PlayerObject | null = null;
export let blueCaptain: PlayerObject | null = null;
export let currentCaptainTurn: PlayerObject | null = null;

let availableSpectators: PlayerObject[] = [];

/**
 * Starts the auto-pick process for 3v3
 */
export function startAutoPick() {
    const players = room.getPlayerList();

    if (players.length < 6) {
        room.sendAnnouncement("⚠️ Not enough players for 3v3 auto-pick (need at least 6).", undefined, 0xFF0000, "bold", 0);
        return;
    }

    isPicking = true;
    
    // Clear current teams
    players.forEach(p => room.setPlayerTeam(p.id, 0));
    redPlayerIdList.length = 0;
    bluePlayerIdList.length = 0;
    specPlayerIdList.length = 0;
    players.forEach(p => specPlayerIdList.push(p.id));

    // Choose captains (first two in spectators for simplicity, or based on rank if needed)
    // Here we just take the first two available spectators
    const currentSpecs = room.getPlayerList().filter(p => p.team === 0);
    redCaptain = currentSpecs[0] || null;
    blueCaptain = currentSpecs[1] || null;

    if (!redCaptain || !blueCaptain) {
        room.sendAnnouncement("⚠️ Error choosing captains.", undefined, 0xFF0000, "bold", 0);
        resetPick();
        return;
    }

    movePlayerToTeam(redCaptain.id, redPlayerIdList);
    movePlayerToTeam(blueCaptain.id, bluePlayerIdList);

    currentCaptainTurn = redCaptain; // Red picks first
    room.sendAnnouncement(`🎮 Auto-pick started! Captains: Red - ${redCaptain.name}, Blue - ${blueCaptain.name}`, undefined, 0xFFFF00, "bold", 0);
    showAvailablePlayers();
}

/**
 * Displays the list of spectators with numbers
 */
export function showAvailablePlayers() {
    if (!isPicking || !currentCaptainTurn) return;

    availableSpectators = room.getPlayerList().filter(p => p.team === 0);
    
    if (availableSpectators.length === 0) {
        room.sendAnnouncement("🏁 No more players to pick.", undefined, 0xFFFF00, "bold", 0);
        finishPick();
        return;
    }

    const playerListMsg = availableSpectators.map((p, i) => `${p.name}[${i + 1}]`).join(", ");
    room.sendAnnouncement(`👉 ${currentCaptainTurn.name}'s turn to pick.`, undefined, currentCaptainTurn.team === 1 ? 0xFF3333 : 0x3366FF, "bold", 0);
    room.sendAnnouncement(`Players: ${playerListMsg}`, undefined, 0xFFFFFF, "normal", 0);
    room.sendAnnouncement(`Commands: [number], top, bottom, random`, undefined, 0xAAAAAA, "italic", 0);
}

/**
 * Handles a pick from a captain
 */
export function handleCaptainPick(player: PlayerObject, message: string): boolean {
    if (!isPicking || !currentCaptainTurn || player.id !== currentCaptainTurn.id) return false;

    const lowerMsg = message.toLowerCase().trim();
    let pickedPlayer: PlayerObject | null = null;

    if (lowerMsg === "top") {
        pickedPlayer = availableSpectators[0] || null;
    } else if (lowerMsg === "bottom") {
        pickedPlayer = availableSpectators[availableSpectators.length - 1] || null;
    } else if (lowerMsg === "random") {
        pickedPlayer = availableSpectators[Math.floor(Math.random() * availableSpectators.length)] || null;
    } else {
        const pickIndex = parseInt(lowerMsg) - 1;
        if (!isNaN(pickIndex) && pickIndex >= 0 && pickIndex < availableSpectators.length) {
            pickedPlayer = availableSpectators[pickIndex] || null;
        }
    }

    if (pickedPlayer) {
        const teamList = player.team === 1 ? redPlayerIdList : bluePlayerIdList;
        movePlayerToTeam(pickedPlayer.id, teamList);
        room.sendAnnouncement(`✅ ${player.name} picked ${pickedPlayer.name}!`, undefined, player.team === 1 ? 0xFF3333 : 0x3366FF, "bold", 0);
        
        // Check if teams are full (3v3)
        if (redPlayerIdList.length >= 3 && bluePlayerIdList.length >= 3) {
            finishPick();
        } else {
            // Toggle turn
            // Logic: 1-1-1-1 or 1-2-1? Usually 1-2-2-1 in many pick systems, but 1-1-1-1 is simpler.
            // Let's do 1-1-1-1 for now.
            currentCaptainTurn = currentCaptainTurn.id === redCaptain?.id ? blueCaptain : redCaptain;
            showAvailablePlayers();
        }
        return true;
    }

    return false;
}

function finishPick() {
    isPicking = false;
    currentCaptainTurn = null;
    room.sendAnnouncement("🏁 Teams are ready! Starting game...", undefined, 0x00FF00, "bold", 0);
    room.startGame();
}

export function resetPick() {
    isPicking = false;
    redCaptain = null;
    blueCaptain = null;
    currentCaptainTurn = null;
    availableSpectators = [];
}

/**
 * Handles a player leaving during the pick process
 */
export function handlePlayerLeavePick(player: PlayerObject) {
    if (!isPicking) return;

    if (player.id === redCaptain?.id || player.id === blueCaptain?.id) {
        room.sendAnnouncement("⚠️ A captain left! Resetting auto-pick...", undefined, 0xFF0000, "bold", 0);
        resetPick();
    } else {
        // If an available player left, just refresh the list display
        // No need to do much as showAvailablePlayers() filters the current room list
        showAvailablePlayers();
    }
}
