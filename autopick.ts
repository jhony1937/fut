import { room } from "./index.js";
import { getQueueList, getSpectatorByIndex } from "./spectatorQueue.js";
import { movePlayerToTeam } from "./teammanagement.js";

// Selection state
export let isPicking = false;
let currentCaptainId: number | null = null;
let picksRemaining = 0;
let pickTimer: NodeJS.Timeout | null = null;
const PICK_TIMEOUT_MS = 10000;

/**
 * Sets the picking state
 */
export function setPickingState(state: boolean): void {
    isPicking = state;
    if (!state) {
        clearPickTimer();
        currentCaptainId = null;
        picksRemaining = 0;
    }
}

/**
 * Starts the picking phase
 * @param captainId The player ID of the captain (FIFO from specs)
 * @param totalPicks Number of players the captain needs to select
 */
export function startPickingPhase(captainId: number, totalPicks: number): void {
    const captain = room.getPlayer(captainId);
    if (!captain) return;

    setPickingState(true);
    currentCaptainId = captainId;
    picksRemaining = totalPicks;

    // Move captain to Blue
    movePlayerToTeam(captainId, 2);

    room.sendAnnouncement(`📢 Captain: ${captain.name} - Enter the player's number to select - You have 10 seconds.`, undefined, 0x00FFFF, "bold");
    
    displaySpectators();
    resetPickTimer();
}

/**
 * Displays the current spectator list with numbers
 */
export function displaySpectators(targetPlayerId?: number): void {
    const specs = getQueueList();
    if (specs.length === 0) {
        if (isPicking) {
            room.sendAnnouncement("📢 No more spectators to pick.", undefined, 0xFFFF00, "bold");
            finalizePicking();
        }
        return;
    }

    room.sendAnnouncement("📋 --- SPECTATORS LIST --- 📋", targetPlayerId, 0x00FFFF, "bold");
    specs.forEach((spec, index) => {
        room.sendAnnouncement(`${index + 1} - ${spec.name}`, targetPlayerId, 0xFFFFFF, "normal");
    });
}

/**
 * Handles picking logic in chat
 */
export function handleCaptainPick(player: PlayerObject, message: string): boolean {
    if (!isPicking || player.id !== currentCaptainId) return false;

    const trimmedMsg = message.trim().toLowerCase();

    // Handle "random" pick
    if (trimmedMsg === "random") {
        pickRandomPlayer();
        return true;
    }

    // Handle number-based pick
    const index = parseInt(trimmedMsg);
    if (isNaN(index)) return false; // Not a number, maybe normal chat

    const target = getSpectatorByIndex(index);
    if (!target) {
        room.sendAnnouncement(`⚠️ Invalid number: No spectator found at ${index}.`, player.id, 0xFF0000, "normal");
        return true; 
    }

    executePick(target);
    return true; 
}

/**
 * Executes a pick and moves the player
 */
function executePick(target: PlayerObject): void {
    const captain = room.getPlayer(currentCaptainId!);
    const captainName = captain ? captain.name : "Captain";

    room.sendAnnouncement(`[${captainName}] Select: ${target.name}.`, undefined, 0x00FF00, "bold");
    movePlayerToTeam(target.id, 2); // Move to Blue

    picksRemaining--;

    if (picksRemaining > 0) {
        displaySpectators();
        resetPickTimer();
    } else {
        finalizePicking();
    }
}

/**
 * Picks a random player from the current spectators
 */
function pickRandomPlayer(): void {
    const specs = getQueueList();
    if (specs.length === 0) {
        finalizePicking();
        return;
    }

    const randomIndex = Math.floor(Math.random() * specs.length);
    const target = specs[randomIndex]!;
    executePick(target);
}

/**
 * Finalizes the picking phase and starts the game if possible
 */
function finalizePicking(): void {
    setPickingState(false);
    room.sendAnnouncement("✅ Picking phase complete!", undefined, 0x00FF00, "bold");
    
    // Auto start by checking logic
    applyPlayerCountLogic();
}

/**
 * Resets the 10-second timer for the current pick
 */
function resetPickTimer(): void {
    clearPickTimer();
    pickTimer = setTimeout(() => {
        if (isPicking) {
            room.sendAnnouncement("⏰ Time's up! Picking a random player...", undefined, 0xFF0000, "bold");
            pickRandomPlayer();
        }
    }, PICK_TIMEOUT_MS);
}

/**
 * Clears the active pick timer
 */
function clearPickTimer(): void {
    if (pickTimer) {
        clearTimeout(pickTimer);
        pickTimer = null;
    }
}

/**
 * Handles picking state when a player leaves
 */
export function handlePlayerLeavePick(player: PlayerObject): void {
    if (!isPicking) return;

    // If the captain leaves, cancel picking or choose a new one?
    // User didn't specify, but usually we cancel and maybe restart or random pick.
    // Let's just random pick everything if captain leaves to avoid stuck state.
    if (player.id === currentCaptainId) {
        room.sendAnnouncement("⚠️ Captain left! Finishing picks randomly...", undefined, 0xFF0000, "bold");
        while (isPicking && picksRemaining > 0) {
            pickRandomPlayer();
        }
        return;
    }

    // Update list if a spectator left
    if (player.team === 0) {
        displaySpectators();
    }
}
