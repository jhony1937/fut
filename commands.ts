import { room } from "./index.js";
import { 
    getPlayerStatsFromDB, 
    getRankObjectByName, 
    getLeaderboardFromDB, 
    setPlayerRankInDB, 
    setPlayerWinsInDB,
    setPlayerGoalsInDB,
    setPlayerAssistsInDB,
    RANKS 
} from "./stats.js";

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
            const rankObj = getRankObjectByName(stats.rank);
            room.sendAnnouncement(`🎖️ Rank: ${rankObj.name} | Elo: ${stats.elo}`, player.id, rankObj.color, "bold", 0);
        }
    },
    {
        name: "stats",
        description: "shows stats for you or another player (!stats @player)",
        emoji: "📊",
        adminOnly: false,
        response: async (player: PlayerObject, args: string[]) => {
            let targetName = player.name;
            if (args.length > 0) {
                const mention = args[0]!;
                targetName = mention.startsWith("@") ? mention.substring(1).trim() : mention.trim();
            }

            const stats = await getPlayerStatsFromDB(targetName);
            const rankObj = getRankObjectByName(stats.rank);
            
            room.sendAnnouncement(`📊 Player Stats: ${targetName}`, player.id, 0x00FFFF, "bold", 0);
            room.sendAnnouncement(`Rank: ${rankObj.name}`, player.id, rankObj.color, "bold", 0);
            room.sendAnnouncement(`Level: ${rankObj.level}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`ELO: ${stats.elo}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`Wins: ${stats.wins}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`Goals: ${stats.goals}`, player.id, 0xFFFFFF, "bold", 0);
            room.sendAnnouncement(`Assists: ${stats.assists}`, player.id, 0xFFFFFF, "bold", 0);
        }
    },
    {
        name: "goals",
        description: "shows your goals or another player's goals (!goals @player)",
        emoji: "⚽",
        adminOnly: false,
        response: async (player: PlayerObject, args: string[]) => {
            let targetName = player.name;
            if (args.length > 0) {
                const mention = args[0]!;
                targetName = mention.startsWith("@") ? mention.substring(1).trim() : mention.trim();
            }
            const stats = await getPlayerStatsFromDB(targetName);
            room.sendAnnouncement(`⚽ Player ${targetName} has ${stats.goals} goals.`, player.id, 0xFFFFFF, "bold", 0);
        }
    },
    {
        name: "assists",
        description: "shows your assists or another player's assists (!assists @player)",
        emoji: "🎯",
        adminOnly: false,
        response: async (player: PlayerObject, args: string[]) => {
            let targetName = player.name;
            if (args.length > 0) {
                const mention = args[0]!;
                targetName = mention.startsWith("@") ? mention.substring(1).trim() : mention.trim();
            }
            const stats = await getPlayerStatsFromDB(targetName);
            room.sendAnnouncement(`🎯 Player ${targetName} has ${stats.assists} assists.`, player.id, 0xFFFFFF, "bold", 0);
        }
    },
    {
        name: "wins",
        description: "shows your wins or another player's wins (!wins @player)",
        emoji: "📈",
        adminOnly: false,
        response: async (player: PlayerObject, args: string[]) => {
            let targetName = player.name;
            if (args.length > 0) {
                const mention = args[0]!;
                targetName = mention.startsWith("@") ? mention.substring(1).trim() : mention.trim();
            }
            const stats = await getPlayerStatsFromDB(targetName);
            room.sendAnnouncement(`📈 Player ${targetName} has ${stats.wins} wins.`, player.id, 0xFFFFFF, "bold", 0);
        }
    },
    {
        name: "leaderboard",
        description: "shows TOP 10 players sorted by Goals, Wins, Assists",
        emoji: "🏆",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const topPlayers = await getLeaderboardFromDB(10);
            room.sendAnnouncement("🏆 --- TOP 10 LEADERBOARD (GOALS > WINS > ASSISTS) --- 🏆", player.id, 0xFFFF00, "bold", 0);
            if (topPlayers.length === 0) {
                room.sendAnnouncement("No data yet.", player.id, 0xFFFFFF, "normal", 0);
            } else {
                topPlayers.forEach((entry, index) => {
                    const rankObj = getRankObjectByName(entry.rank);
                    const position = index + 1;
                    let color = 0xFFFFFF;
                    let style: "normal" | "bold" | "italic" | "small" | "small-bold" | "small-italic" = "normal";

                    if (position <= 3) {
                        color = 0xFFD700; // Gold for top 3
                        style = "bold";
                    }

                    room.sendAnnouncement(
                        `${position}. ${entry.name}: ${entry.goals} Goals, ${entry.wins} Wins, ${entry.assists} Assists (${rankObj.name})`, 
                        player.id, 
                        color, 
                        style, 
                        0
                    );
                });
            }
        }
    },
    {
        name: "setwins",
        description: "manually set a player's wins (!setwins @player number)",
        emoji: "📈",
        adminOnly: true,
        response: async (admin: PlayerObject, args: string[]) => {
            if (args.length < 2) {
                room.sendAnnouncement("🚫 Usage: !setwins @PlayerName Number", admin.id, 0xFF0000, "bold", 0);
                return;
            }
            const targetMention = args[0]!;
            const value = parseInt(args[1]!);
            const targetName = targetMention.startsWith("@") ? targetMention.substring(1).trim() : targetMention.trim();

            if (isNaN(value)) {
                room.sendAnnouncement("🚫 Invalid number.", admin.id, 0xFF0000, "bold", 0);
                return;
            }

            const result = await setPlayerWinsInDB(targetName, value);
            if (result === "success") {
                room.sendAnnouncement(`✅ Player @${targetName} wins set to ${value}.`, undefined, 0x00FF00, "bold", 0);
            } else if (result === "not_found") {
                room.sendAnnouncement(`🚫 Player @${targetName} not found in database.`, admin.id, 0xFF0000, "bold", 0);
            } else {
                room.sendAnnouncement(`🚫 Error updating wins.`, admin.id, 0xFF0000, "bold", 0);
            }
        }
    },
    {
        name: "setgoals",
        description: "manually set a player's goals (!setgoals @player number)",
        emoji: "⚽",
        adminOnly: true,
        response: async (admin: PlayerObject, args: string[]) => {
            if (args.length < 2) {
                room.sendAnnouncement("🚫 Usage: !setgoals @PlayerName Number", admin.id, 0xFF0000, "bold", 0);
                return;
            }
            const targetMention = args[0]!;
            const value = parseInt(args[1]!);
            const targetName = targetMention.startsWith("@") ? targetMention.substring(1).trim() : targetMention.trim();

            if (isNaN(value)) {
                room.sendAnnouncement("🚫 Invalid number.", admin.id, 0xFF0000, "bold", 0);
                return;
            }

            const result = await setPlayerGoalsInDB(targetName, value);
            if (result === "success") {
                room.sendAnnouncement(`✅ Player @${targetName} goals set to ${value}.`, undefined, 0x00FF00, "bold", 0);
            } else if (result === "not_found") {
                room.sendAnnouncement(`🚫 Player @${targetName} not found in database.`, admin.id, 0xFF0000, "bold", 0);
            } else {
                room.sendAnnouncement(`🚫 Error updating goals.`, admin.id, 0xFF0000, "bold", 0);
            }
        }
    },
    {
        name: "setassists",
        description: "manually set a player's assists (!setassists @player number)",
        emoji: "🎯",
        adminOnly: true,
        response: async (admin: PlayerObject, args: string[]) => {
            if (args.length < 2) {
                room.sendAnnouncement("🚫 Usage: !setassists @PlayerName Number", admin.id, 0xFF0000, "bold", 0);
                return;
            }
            const targetMention = args[0]!;
            const value = parseInt(args[1]!);
            const targetName = targetMention.startsWith("@") ? targetMention.substring(1).trim() : targetMention.trim();

            if (isNaN(value)) {
                room.sendAnnouncement("🚫 Invalid number.", admin.id, 0xFF0000, "bold", 0);
                return;
            }

            const result = await setPlayerAssistsInDB(targetName, value);
            if (result === "success") {
                room.sendAnnouncement(`✅ Player @${targetName} assists set to ${value}.`, undefined, 0x00FF00, "bold", 0);
            } else if (result === "not_found") {
                room.sendAnnouncement(`🚫 Player @${targetName} not found in database.`, admin.id, 0xFF0000, "bold", 0);
            } else {
                room.sendAnnouncement(`🚫 Error updating assists.`, admin.id, 0xFF0000, "bold", 0);
            }
        }
    },
    {
        name: "setrank",
        description: "manually set a player's rank (!setrank @player rankName)",
        emoji: "👑",
        adminOnly: true,
        response: async (admin: PlayerObject, args: string[]) => {
            if (args.length < 2) {
                room.sendAnnouncement("🚫 Usage: !setrank @PlayerName RankName", admin.id, 0xFF0000, "bold", 0);
                return;
            }

            const targetMention = args[0]!;
            const rankName = args.slice(1).join(" ");
            const targetName = targetMention.startsWith("@") ? targetMention.substring(1).trim() : targetMention.trim();

            if (!targetName) {
                room.sendAnnouncement("🚫 Invalid player name.", admin.id, 0xFF0000, "bold", 0);
                return;
            }

            // Find player in the room (optional for manual setting, but good for verification)
            let targetPlayer = room.getPlayerList().find(p => p.name.toLowerCase() === targetName.toLowerCase());
            let finalTargetName = targetPlayer ? targetPlayer.name : targetName;

            // Validate rank
            const rankObj = RANKS.find(r => r.name.toLowerCase() === rankName.toLowerCase());
            if (!rankObj) {
                const availableRanks = RANKS.map(r => r.name).join(", ");
                room.sendAnnouncement(`🚫 Invalid rank. Available ranks: ${availableRanks}.`, admin.id, 0xFF0000, "bold", 0);
                return;
            }

            const result = await setPlayerRankInDB(finalTargetName, rankObj.name);
            
            if (result === "success") {
                const isVIP = rankObj.name === "VIP";
                const messageColor = isVIP ? 0xFFFF00 : 0x00FF00;
                room.sendAnnouncement(`✅ Player @${finalTargetName} is now ${rankObj.name}.`, undefined, messageColor, "bold", 0);
                
                if (isVIP) {
                    room.sendAnnouncement(`✨ GLOW: @${finalTargetName} has received VIP status! ✨`, undefined, 0xFFFF00, "bold", 0);
                }
            } else if (result === "not_found") {
                room.sendAnnouncement(`🚫 Player @${finalTargetName} not found in database. (They must join at least once)`, admin.id, 0xFF0000, "bold", 0);
            } else {
                room.sendAnnouncement(`🚫 Database error while setting rank. Check your Supabase URL/Key.`, admin.id, 0xFF0000, "bold", 0);
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
