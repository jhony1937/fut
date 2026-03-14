import { room } from "./index.js";
import { getPlayerStatsFromDB, getRankObjectByElo, getTopPlayersFromDB } from "./stats.js";

interface Command {
    name: string;
    description: string;
    emoji: string;
    adminOnly: boolean
    response: (player: PlayerObject, args: string[]) => Promise<void>;
}

const commands: Command[] = [
    {
        name: "help",
        description: "show the list of commands and their functions",
        emoji: "❓",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            commands.forEach((command) => {
                if (command.adminOnly && !player.admin) return;
                sendBoldWhiteAnnouncement(`${command.emoji} !${command.name}: ${command.description}.`, player.id);
            });
        }
    },
    {
        name: "rank",
        description: "shows your current rank and Elo points",
        emoji: "🎖️",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const stats = await getPlayerStatsFromDB(player.name);
            const rankObj = getRankObjectByElo(stats.elo);
            room.sendAnnouncement(`�️ Rank: ${rankObj.name} | Elo: ${stats.elo}`, player.id, rankObj.color, "bold", 0);
        }
    },
    {
        name: "stats",
        description: "shows your total wins, goals, and assists",
        emoji: "📊",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const stats = await getPlayerStatsFromDB(player.name);
            const rankObj = getRankObjectByElo(stats.elo);
            room.sendAnnouncement(`📊 Player Stats`, player.id, 0x00FFFF, "bold", 0);
            room.sendAnnouncement(`Name: ${player.name}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`Rank: ${rankObj.name}`, player.id, rankObj.color, "bold", 0);
            room.sendAnnouncement(`ELO: ${stats.elo}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`Wins: ${stats.wins}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`Goals: ${stats.goals}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`Assists: ${stats.assists}`, player.id, 0xFFFFFF, "bold", 0);
        }
    },
    {
        name: "top",
        description: "shows TOP 10 players leaderboard based on Elo",
        emoji: "�",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const topPlayers = await getTopPlayersFromDB(10);
            room.sendAnnouncement("� --- TOP 10 LEADERBOARD (ELO) --- �", player.id, 0xFFFF00, "bold", 0);
            if (topPlayers.length === 0) {
                room.sendAnnouncement("No data yet.", player.id, 0xFFFFFF, "normal", 0);
            } else {
                topPlayers.forEach((entry, index) => {
                    const rankObj = getRankObjectByElo(entry.elo);
                    room.sendAnnouncement(`${index + 1}. ${entry.name}: ${entry.elo} Elo (${rankObj.name})`, player.id, 0xFFFFFF, "normal", 0);
                });
            }
        }
    },
    {
        name: "rules",
        description: "show the server rules",
        emoji: "📜",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            room.sendAnnouncement("📜 --- SERVER RULES --- 📜", player.id, 0xFFFF00, "bold", 0);
            room.sendAnnouncement("1. No bad words.", player.id, 0xFFFFFF, "normal", 0);
            room.sendAnnouncement("2. No spamming.", player.id, 0xFFFFFF, "normal", 0);
            room.sendAnnouncement("3. Respect other players.", player.id, 0xFFFFFF, "normal", 0);
            room.sendAnnouncement("4. Have fun!", player.id, 0xFFFFFF, "normal", 0);
        }
    },
    {
        name: "bb",
        description: "leave the room",
        emoji: "👋",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            room.kickPlayer(player.id, "Command !bb", false);
        }
    }
];

export async function checkAndHandleCommands(player: PlayerObject, message: string): Promise<boolean> {
    if (!isCommand(message)) return false;
    
    const fullCommand = message.substring(1).split(" ");
    const commandName = fullCommand[0]?.toLowerCase();
    const args = fullCommand.slice(1);

    const command = commands.find((command) => command.name === commandName);
    
    if (!command) {
        room.sendAnnouncement("🚫 This command does not exist. Type !help to see the list of commands.", player.id, 0xFF0000, "bold", 0);
        return true;
    }

    if (command.adminOnly && !player.admin) {
        room.sendAnnouncement("🚫 You do not have permission to use this command.", player.id, 0xFF0000, "bold", 0);
        return true;
    }

    await command.response(player, args);
    return true;
}

export function isCommand(message: string): boolean {
    return (message !== "!" && message.startsWith("!"))
}

function sendBoldWhiteAnnouncement(message: string, playerId: number) {
    room.sendAnnouncement(message, playerId, 0xFFFFFF, "bold", 0);
}
