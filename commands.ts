import { room } from "./index.js";
import { 
    getPlayerStatsFromDB, 
    getTopPlayersByStat,
    setPlayerWinsInDB,
    setPlayerGoalsInDB,
    setPlayerAssistsInDB,
    setPlayerRankInDB
} from "./stats.js";

interface Command {
    name: string;
    description: string;
    emoji: string;
    adminOnly: boolean;
    response: (player: PlayerObject, args: string[]) => Promise<void>;
}

const commands: Command[] = [
    {
        name: "stats",
        description: "show your goals, assists, wins, rank",
        emoji: "📊",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const stats = await getPlayerStatsFromDB(player.name);
            room.sendAnnouncement(`📊 Stats for ${player.name}: Goals: ${stats.goals} | Assists: ${stats.assists} | Wins: ${stats.wins} | Rank: ${stats.rank}`, player.id, 0x00FFFF, "bold");
        }
    },
    {
        name: "wins",
        description: "show your wins + rank",
        emoji: "🏆",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const stats = await getPlayerStatsFromDB(player.name);
            room.sendAnnouncement(`🏆 Wins for ${player.name}: ${stats.wins} | Rank: ${stats.rank}`, player.id, 0x00FF00, "bold");
        }
    },
    {
        name: "goals",
        description: "show your goals",
        emoji: "⚽",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const stats = await getPlayerStatsFromDB(player.name);
            room.sendAnnouncement(`⚽ Goals for ${player.name}: ${stats.goals}`, player.id, 0xFFFF00, "bold");
        }
    },
    {
        name: "assists",
        description: "show your assists",
        emoji: "👟",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const stats = await getPlayerStatsFromDB(player.name);
            room.sendAnnouncement(`👟 Assists for ${player.name}: ${stats.assists}`, player.id, 0xFFA500, "bold");
        }
    },
    {
        name: "help",
        description: "show the list of commands",
        emoji: "❓",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            room.sendAnnouncement("📜 --- COMMANDS --- 📜", player.id, 0xFFFF00, "bold");
            commands.forEach((command) => {
                if (command.adminOnly && !player.admin) return;
                room.sendAnnouncement(`${command.emoji} !${command.name}: ${command.description}`, player.id, 0xFFFFFF, "normal");
            });
        }
    },
    {
        name: "topwins",
        description: "show TOP 10 players with the most wins",
        emoji: "📈",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const top = await getTopPlayersByStat("wins", 10);
            room.sendAnnouncement("🏆 --- TOP WINS --- 🏆", player.id, 0xFFFF00, "bold");
            if (!top || top.length === 0) {
                room.sendAnnouncement("No players found yet.", player.id, 0xFFFFFF, "normal");
                return;
            }
            top.forEach((entry, index) => {
                const color = index < 3 ? 0xFFD700 : 0xFFFFFF;
                room.sendAnnouncement(`${index + 1}. ${entry.name} - ${entry.wins} wins`, player.id, color, index < 3 ? "bold" : "normal");
            });
        }
    },
    {
        name: "topgoals",
        description: "show TOP 10 players with the most goals",
        emoji: "⚽",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const top = await getTopPlayersByStat("goals", 10);
            room.sendAnnouncement("⚽ --- TOP GOALS --- ⚽", player.id, 0xFFFF00, "bold");
            if (!top || top.length === 0) {
                room.sendAnnouncement("No players found yet.", player.id, 0xFFFFFF, "normal");
                return;
            }
            top.forEach((entry, index) => {
                const color = index < 3 ? 0xFFD700 : 0xFFFFFF;
                room.sendAnnouncement(`${index + 1}. ${entry.name} - ${entry.goals} goals`, player.id, color, index < 3 ? "bold" : "normal");
            });
        }
    },
     {
         name: "setwins",
         description: "set wins for a player (!setwins @player amount)",
         emoji: "🛠️",
         adminOnly: true,
         response: async (player: PlayerObject, args: string[]) => {
             if (args.length < 2) {
                 room.sendAnnouncement("⚠️ Usage: !setwins @player amount", player.id, 0xFF0000, "bold");
                 return;
             }
             const mention = args[0]!;
             const targetName = mention.startsWith("@") ? mention.substring(1).trim() : mention.trim();
             const amount = parseInt(args[1]!);
             if (isNaN(amount)) {
                 room.sendAnnouncement("⚠️ Invalid amount.", player.id, 0xFF0000, "bold");
                 return;
             }
             await setPlayerWinsInDB(targetName, amount);
             room.sendAnnouncement(`✅ Wins for ${targetName} set to ${amount}.`, player.id, 0x00FF00, "bold");
         }
     },
     {
         name: "setgoals",
         description: "set goals for a player (!setgoals @player amount)",
         emoji: "🛠️",
         adminOnly: true,
         response: async (player: PlayerObject, args: string[]) => {
             if (args.length < 2) {
                 room.sendAnnouncement("⚠️ Usage: !setgoals @player amount", player.id, 0xFF0000, "bold");
                 return;
             }
             const mention = args[0]!;
             const targetName = mention.startsWith("@") ? mention.substring(1).trim() : mention.trim();
             const amount = parseInt(args[1]!);
             if (isNaN(amount)) {
                 room.sendAnnouncement("⚠️ Invalid amount.", player.id, 0xFF0000, "bold");
                 return;
             }
             await setPlayerGoalsInDB(targetName, amount);
             room.sendAnnouncement(`✅ Goals for ${targetName} set to ${amount}.`, player.id, 0x00FF00, "bold");
         }
     },
     {
         name: "setassists",
         description: "set assists for a player (!setassists @player amount)",
         emoji: "🛠️",
         adminOnly: true,
         response: async (player: PlayerObject, args: string[]) => {
             if (args.length < 2) {
                 room.sendAnnouncement("⚠️ Usage: !setassists @player amount", player.id, 0xFF0000, "bold");
                 return;
             }
             const mention = args[0]!;
             const targetName = mention.startsWith("@") ? mention.substring(1).trim() : mention.trim();
             const amount = parseInt(args[1]!);
             if (isNaN(amount)) {
                 room.sendAnnouncement("⚠️ Invalid amount.", player.id, 0xFF0000, "bold");
                 return;
             }
             await setPlayerAssistsInDB(targetName, amount);
             room.sendAnnouncement(`✅ Assists for ${targetName} set to ${amount}.`, player.id, 0x00FF00, "bold");
         }
     },
     {
         name: "setrank",
         description: "set rank for a player (!setrank @player rank)",
         emoji: "🛠️",
         adminOnly: true,
         response: async (player: PlayerObject, args: string[]) => {
             if (args.length < 2) {
                 room.sendAnnouncement("⚠️ Usage: !setrank @player rank", player.id, 0xFF0000, "bold");
                 return;
             }
             const mention = args[0]!;
             const targetName = mention.startsWith("@") ? mention.substring(1).trim() : mention.trim();
             const rank = args.slice(1).join(" ");
             await setPlayerRankInDB(targetName, rank);
             room.sendAnnouncement(`✅ Rank for ${targetName} set to ${rank}.`, player.id, 0x00FF00, "bold");
         }
     }
 ];

export function isCommand(message: string): boolean {
    return message.startsWith("!");
}

export async function checkAndHandleCommands(player: PlayerObject, message: string): Promise<void> {
    const args = message.substring(1).split(" ");
    const commandName = args.shift()?.toLowerCase();

    const command = commands.find(c => c.name === commandName);
    if (command) {
        if (command.adminOnly && !player.admin) {
            room.sendAnnouncement("🚫 This command is for admins only.", player.id, 0xFF0000, "bold");
            return;
        }
        await command.response(player, args);
    }
}
