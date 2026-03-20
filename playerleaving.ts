import { removePlayerFromAfkMapsAndSets } from "./afkdetection.js";
import { room, pauseUnpauseGame, restartGameWithCallback } from "./index.js";
import { movePlayerToTeam, moveLastOppositeTeamMemberToSpec, applyPlayerCountLogic } from "./teammanagement.js";
import { getNextSpectator } from "./spectatorQueue.js";
import { isPicking } from "./autopick.js";

export function handlePlayerLeaving(player: PlayerObject): void {
    if (isPicking) return; // Let autopick handle it via handlePlayerLeavePick
    const playerList = room.getPlayerList();
    
    if (player.team !== 0) {
        if (playerList.length !== 0) handleTeamPlayerLeaving(player);
    }
    
    removePlayerFromAfkMapsAndSets(player.id);
    
    if (playerList.length === 0) {
        room.stopGame();
    } else {
        applyPlayerCountLogic();
    }
    
    console.log(`>>> ${player.name} left the room.`);
}

function handleTeamPlayerLeaving(leavingPlayer: PlayerObject) {
    const playerList = room.getPlayerList();
    const teamId = leavingPlayer.team;
    const oppositeTeamId = teamId === 1 ? 2 : 1;
    
    if (playerList.length === 1) {
        // Only one player left in the room
        restartGameWithCallback(() => movePlayerToTeam(playerList[0]!.id, 1));
    } else {
        const nextSpec = getNextSpectator();
        if (nextSpec) {
            movePlayerToTeam(nextSpec.id, teamId);
        } else {
            // No spectators, move one from opposite team to balance if necessary
            const oppositeTeamPlayers = playerList.filter(p => p.team === oppositeTeamId);
            const currentTeamPlayers = playerList.filter(p => p.team === teamId);
            
            if (oppositeTeamPlayers.length > currentTeamPlayers.length + 1) {
                moveLastOppositeTeamMemberToSpec(oppositeTeamId);
            }
        }
        pauseUnpauseGame();
    }
}
