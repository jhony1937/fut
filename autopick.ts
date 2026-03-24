import { room } from "./index.js";
import { getQueueList, getFullQueueList } from "./spectatorQueue.js";
import { movePlayerToTeam, applyPlayerCountLogic } from "./teammanagement.js";
import { isPlayerAfk, isPickTimeoutActive, getRemainingPickTimeout } from "./afkdetection.js";

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

    room.sendAnnouncement(`📢 Captain: ${captain.name} - Enter the player's number to select - You have 10 seconds.`, captainId, 0x00FFFF, "bold");
    
    displaySpectators(captainId);
    resetPickTimer();
}

/**
 * Displays the current spectator list with numbers
 */
export function displaySpectators(targetPlayerId?: number): void {
    const specs = getFullQueueList(); // Show ALL specs so they can see who is AFK
    const target = targetPlayerId ?? currentCaptainId ?? undefined;

    if (specs.length === 0) {
        if (isPicking) {
            room.sendAnnouncement("📢 No more spectators to pick.", target, 0xFFFF00, "bold");
            finalizePicking();
        }
        return;
    }

    room.sendAnnouncement("📋 --- SPECTATORS LIST --- 📋", target, 0x00FFFF, "bold");
    specs.forEach((spec, index) => {
        const afkStatus = isPlayerAfk(spec.id) ? " [AFK 😴]" : "";
        const timeout = isPickTimeoutActive(spec.id) ? ` [Wait ${getRemainingPickTimeout(spec.id)}s ⏳]` : "";
        room.sendAnnouncement(`${index + 1} - ${spec.name}${afkStatus}${timeout}`, target, 0xFFFFFF, "normal");
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

    // Use full list for indexing but check AFK and Timeout
    const specs = getFullQueueList();
    if (index <= 0 || index > specs.length) {
        room.sendAnnouncement(`⚠️ Invalid number: No spectator found at ${index}.`, player.id, 0xFF0000, "normal");
        return true;
    }

    const target = specs[index - 1]!;
    
    // Check if player is AFK
    if (isPlayerAfk(target.id)) {
        room.sendAnnouncement("⚠️ This player is AFK and cannot be picked", player.id, 0xFF0000, "bold");
        return true;
    }

    // Check if player is in pick timeout (inactive/new)
    if (isPickTimeoutActive(target.id)) {
        const remaining = getRemainingPickTimeout(target.id);
        room.sendAnnouncement(`⏳ ${target.name} is AFK or inactive, please wait ${remaining} seconds before picking`, player.id, 0xFF0000, "bold");
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

    room.sendAnnouncement(`[${captainName}] Select: ${target.name}.`, currentCaptainId!, 0x00FF00, "bold");
    movePlayerToTeam(target.id, 2); // Move to Blue

    picksRemaining--;

    if (picksRemaining > 0) {
        displaySpectators(currentCaptainId!);
        resetPickTimer();
    } else {
        finalizePicking();
    }
}

/**
 * Picks a random player from the current spectators (skipping AFK)
 */
function pickRandomPlayer(): void {
    const availableSpecs = getQueueList(); // This already filters out AFK
    if (availableSpecs.length === 0) {
        finalizePicking();
        return;
    }

    const randomIndex = Math.floor(Math.random() * availableSpecs.length);
    const target = availableSpecs[randomIndex]!;
    executePick(target);
}

/**
 * Finalizes the picking phase and starts the game if possible
 */
function finalizePicking(): void {
    const captainId = currentCaptainId;
    setPickingState(false);
    if (captainId) {
        room.sendAnnouncement("✅ Picking phase complete!", captainId, 0x00FF00, "bold");
    }
    
    // Auto start by checking logic
    applyPlayerCountLogic();
}

/**
 * Resets the 10-second timer for the current pick
 */
function resetPickTimer(): void {
    clearPickTimer();
    const captainId = currentCaptainId;
    pickTimer = setTimeout(() => {
        if (isPicking && captainId) {
            room.sendAnnouncement("⏰ Time's up! Picking a random player...", captainId, 0xFF0000, "bold");
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
