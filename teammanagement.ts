import { removePlayerFromAfkMapsAndSets, setLastPlayerActivityTimestamp } from "./afkdetection.js";
import { bluePlayerIdList, redPlayerIdList, room, specPlayerIdList } from "./index.js";

export function movePlayerToTeam(playerId: number, teamPlayerIdList: number[]) {
    if (teamPlayerIdList.includes(playerId)) return;
    const oppositeTeamPlayerIdList: number[] = teamPlayerIdList === redPlayerIdList ? bluePlayerIdList : redPlayerIdList;
    const teamId: number = teamPlayerIdList === redPlayerIdList ? 1 : 2;
    room.setPlayerTeam(playerId, teamId);
    teamPlayerIdList.push(playerId);
    if (oppositeTeamPlayerIdList.includes(playerId)) oppositeTeamPlayerIdList.splice(oppositeTeamPlayerIdList.indexOf(playerId), 1);
    if (specPlayerIdList.includes(playerId)) specPlayerIdList.splice(specPlayerIdList.indexOf(playerId), 1);
    setLastPlayerActivityTimestamp(playerId);
}

function movePlayerToSpec(playerId: number) {
    room.setPlayerTeam(playerId, 0);
    specPlayerIdList.push(playerId);
    if (redPlayerIdList.includes(playerId)) redPlayerIdList.splice(redPlayerIdList.indexOf(playerId), 1);
    if (bluePlayerIdList.includes(playerId)) bluePlayerIdList.splice(bluePlayerIdList.indexOf(playerId), 1);
    removePlayerFromAfkMapsAndSets(playerId);
}

export function moveOneSpecToEachTeam(): void {
    const teamPlayerIdLists = [redPlayerIdList, bluePlayerIdList];
    teamPlayerIdLists.forEach(teamPlayerIdList => {
        movePlayerToTeam(specPlayerIdList[0]!, teamPlayerIdList);
    });
}

export function moveLastOppositeTeamMemberToSpec(oppositeTeamPlayerIdList: number[]): void {
    movePlayerToSpec(oppositeTeamPlayerIdList[oppositeTeamPlayerIdList.length - 1]!);
}

export function handleTeamWin(teamPlayerIdList: number[]) {
    if (teamPlayerIdList === redPlayerIdList) {
        if (specPlayerIdList.length === 0) return;
        for (let i = 0; i < bluePlayerIdList.length; i++) {
            movePlayerToSpec(bluePlayerIdList[0]!);
            movePlayerToTeam(specPlayerIdList[0]!, bluePlayerIdList);
        }
        return;
    }
    for (let i = 0; i < bluePlayerIdList.length; i++) {
        if (specPlayerIdList.length) movePlayerToSpec(redPlayerIdList[0]!);
        else movePlayerToTeam(redPlayerIdList[0]!, bluePlayerIdList);
        movePlayerToTeam(bluePlayerIdList[0]!, redPlayerIdList);
        if (specPlayerIdList.length) movePlayerToTeam(specPlayerIdList[0]!, bluePlayerIdList);
    }
}