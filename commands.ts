import { room } from "./index.js";
import { getPlayerStats, getRank, getTopPlayers, playerNames, setPlayerRankByName } from "./stats.js";

interface Command {
    name: string;
    description: string;
    emoji: string;
    adminOnly: boolean
    response: (player: PlayerObject, args: string[]) => void;
}

const commands: Command[] = [
    {
        name: "help",
        description: "show the list of commands and their functions",
        emoji: "❓",
        adminOnly: false,
        response: (player: PlayerObject) => {
            commands.forEach((command) => {
                if (command.adminOnly && !player.admin) return;
                sendBoldWhiteAnnouncement(`${command.emoji} !${command.name}: ${command.description}.`, player.id);
            });
        }
    },
    {
        name: "me",
        description: "show your player statistics and rank",
        emoji: "👤",
        adminOnly: false,
        response: (player: PlayerObject) => {
            const stats = getPlayerStats(player);
            const rank = getRank(stats.wins);
            room.sendAnnouncement(`👤 Stats for ${player.name}:`, player.id, 0x00FFFF, "bold", 0);
            room.sendAnnouncement(`🏆 Wins: ${stats.wins}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`⚽ Goals: ${stats.goals}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`👟 Assists: ${stats.assists}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`🎮 Matches: ${stats.matchesPlayed}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`🎖️ Rank: ${rank}`, player.id, 0x00FF00, "bold", 0);
        }
    },
    {
        name: "wins",
        description: "show your number of wins",
        emoji: "🏆",
        adminOnly: false,
        response: (player: PlayerObject) => {
            const stats = getPlayerStats(player);
            sendBoldWhiteAnnouncement(`🏆 You have ${stats.wins} wins.`, player.id);
        }
    },
    {
        name: "goals",
        description: "show your number of goals",
        emoji: "⚽",
        adminOnly: false,
        response: (player: PlayerObject) => {
            const stats = getPlayerStats(player);
            sendBoldWhiteAnnouncement(`⚽ You have ${stats.goals} goals.`, player.id);
        }
    },
    {
        name: "rank",
        description: "show your current rank",
        emoji: "🎖️",
        adminOnly: false,
        response: (player: PlayerObject) => {
            const stats = getPlayerStats(player);
            const rank = getRank(stats.wins);
            sendBoldWhiteAnnouncement(`🎖️ Your current rank is: ${rank}`, player.id);
        }
    },
    {
        name: "top",
        description: "show TOP 10 players leaderboard based on wins",
        emoji: "📊",
        adminOnly: false,
        response: (player: PlayerObject) => {
            const topPlayers = getTopPlayers(10);
            room.sendAnnouncement("📊 --- TOP 10 LEADERBOARD --- 📊", player.id, 0xFFFF00, "bold", 0);
            if (topPlayers.length === 0) {
                room.sendAnnouncement("No data yet.", player.id, 0xFFFFFF, "normal", 0);
            } else {
                topPlayers.forEach((entry, index) => {
                    const name = playerNames.get(entry.auth) || "Unknown";
                    const rank = getRank(entry.stats.wins);
                    room.sendAnnouncement(`${index + 1}. ${name}: ${entry.stats.wins} wins (${rank})`, player.id, 0xFFFFFF, "normal", 0);
                });
            }
        }
    },
    {
        name: "setrank",
        description: "manually set a player's rank (!setrank PlayerName RankName)",
        emoji: "👑",
        adminOnly: true,
        response: (player: PlayerObject, args: string[]) => {
            if (args.length < 2) {
                room.sendAnnouncement("🚫 Usage: !setrank PlayerName Rank (e.g., !setrank Midox Diamond III)", player.id, 0xFF0000, "bold", 0);
                return;
            }

            // Find player by name (case-insensitive)
            const targetName = args[0];
            const targetPlayer = room.getPlayerList().find(p => p.name.toLowerCase() === targetName?.toLowerCase());

            if (!targetPlayer) {
                room.sendAnnouncement(`🚫 Player "${targetName}" not found in the room.`, player.id, 0xFF0000, "bold", 0);
                return;
            }

            // Join the remaining args to support multi-word rank names (e.g., "Diamond III")
            const rankName = args.slice(1).join(" ");
            const success = setPlayerRankByName(targetPlayer.auth, rankName);

            if (success) {
                room.sendAnnouncement(`✅ Rank for ${targetPlayer.name} has been set to ${rankName}.`, undefined, 0x00FF00, "bold", 0);
            } else {
                room.sendAnnouncement(`🚫 Invalid rank name: "${rankName}".`, player.id, 0xFF0000, "bold", 0);
            }
        }
    },
    {
        name: "rules",
        description: "show the server rules",
        emoji: "📜",
        adminOnly: false,
        response: (player: PlayerObject) => {
            room.sendAnnouncement("📜 --- SERVER RULES --- 📜", player.id, 0xFFFF00, "bold", 0);
            room.sendAnnouncement("1. No bad words.", player.id, 0xFFFFFF, "normal", 0);
            room.sendAnnouncement("2. No spamming.", player.id, 0xFFFFFF, "normal", 0);
            room.sendAnnouncement("3. Respect other players.", player.id, 0xFFFFFF, "normal", 0);
            room.sendAnnouncement("4. Have fun!", player.id, 0xFFFFFF, "normal", 0);
        }
    },
    {
        name: "discord",
        description: "show the link to the room's public repository",
        emoji: "👨‍💻",
        adminOnly: false,
        response: (player: PlayerObject) => {
            sendBoldWhiteAnnouncement("👨‍💻 : Soooooooon.", player.id);
        }
    },
    {
        name: "bb",
        description: "leave the room",
        emoji: "👋",
        adminOnly: false,
        response: (player: PlayerObject) => {
            room.kickPlayer(player.id, "Command !bb", false);
        }
    }
];

export function checkAndHandleCommands(player: PlayerObject, message: string): boolean {
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

    command.response(player, args);
    return true;
}

export function isCommand(message: string): boolean {
    return (message !== "!" && message.startsWith("!"))
}

function sendBoldWhiteAnnouncement(message: string, playerId: number) {
    room.sendAnnouncement(message, playerId, 0xFFFFFF, "bold", 0);
}
