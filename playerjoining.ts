import { room, specPlayerIdList, debuggingMode, playerConnStrings, adminAuthList, redPlayerIdList, restartGameWithCallback, bluePlayerIdList } from "./index.js";
import { checkAndHandleBadWords } from "./moderation.js";
import { movePlayerToTeam, moveOneSpecToEachTeam } from "./teammanagement.js";

export function handlePlayerJoining(player: PlayerObject): void {
    const playerId: number = player.id;
    const playerName: string = player.name;
    const playerList: PlayerObject[] = room.getPlayerList();
    if (checkAndHandleBadWords(player, playerName)) return;
    if (isPlayerAlreadyConnected(player, player.conn)) return;
    if (adminAuthList.has(player.auth)) room.setPlayerAdmin(playerId, true);
    room.sendAnnouncement(`👋 Bem-vindo, ${playerName}.`, playerId, 0x00FF00, "bold", 0);
    specPlayerIdList.push(playerId);
    console.log(`>>> ${playerName} entrou na sala.`);
    checkAndRestartWithNewMode(playerList);
}

function checkAndRestartWithNewMode(playerList: PlayerObject[]): void {
    const playerListLength: number = playerList.length;
    if (playerListLength === 1) restartGameWithCallback(() => movePlayerToTeam(playerList[0]!.id, redPlayerIdList));
    if (playerListLength === 2) restartGameWithCallback(() => movePlayerToTeam(specPlayerIdList[0]!, bluePlayerIdList));
    if (playerListLength <= 6 && specPlayerIdList.length === 2) restartGameWithCallback(() => moveOneSpecToEachTeam());
}

function isPlayerAlreadyConnected(player: PlayerObject, conn: string): boolean {
    const playerId = player.id;
    if (!debuggingMode && [...playerConnStrings.values()].some(value => value === conn)) {
        room.kickPlayer(playerId, "Já estás conectado à sala", false);
        console.warn(`>>> ${player.name} foi expulso. Razão: conectar-se duas vezes com o mesmo IP.`);
        return true;
    }
    playerConnStrings.set(playerId, conn);
    return false;
}