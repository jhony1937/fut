export let isPicking = false;

export function handleCaptainPick(player: PlayerObject, message: string): boolean {
    // Basic placeholder for handleCaptainPick
    console.log(`handleCaptainPick: ${player.name} sent ${message}`);
    return false;
}

export function handlePlayerLeavePick(player: PlayerObject): void {
    // Basic placeholder for handlePlayerLeavePick
    console.log(`handlePlayerLeavePick: ${player.name} left`);
}
