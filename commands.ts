import { room } from "./index.js";
import { 
    getPlayerStatsFromDB, 
    getTopPlayersByStat,
    setPlayerWinsInDB,
    setPlayerGoalsInDB,
    setPlayerAssistsInDB,
    setPlayerRankInDB
} from "./stats.js";
import { getQueueList } from "./spectatorQueue.js";
import { movePlayerToTeam, applyPlayerCountLogic } from "./teammanagement.js";
import { setPlayerAfk, isPlayerAfk, getAfkPlayerNames } from "./afkdetection.js";

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
        description: "show TOP 8 players with the most wins",
        emoji: "🏆",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const top = await getTopPlayersByStat("wins", 8);
            room.sendAnnouncement("🏆 --- TOP 8 WINS --- 🏆", player.id, 0xFFFF00, "bold");
            if (!top || top.length === 0) {
                room.sendAnnouncement("No players found yet.", player.id, 0xFFFFFF, "normal");
                return;
            }
            top.forEach((entry, index) => {
                const color = index < 3 ? 0xFFD700 : 0xFFFFFF;
                room.sendAnnouncement(`${index + 1}. ${entry.name} - ${entry.wins}`, player.id, color, index < 3 ? "bold" : "normal");
            });
        }
    },
    {
        name: "goals",
        description: "show TOP 8 players with the most goals",
        emoji: "⚽",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const top = await getTopPlayersByStat("goals", 8);
            room.sendAnnouncement("⚽ --- TOP 8 GOALS --- ⚽", player.id, 0xFFFF00, "bold");
            if (!top || top.length === 0) {
                room.sendAnnouncement("No players found yet.", player.id, 0xFFFFFF, "normal");
                return;
            }
            top.forEach((entry, index) => {
                const color = index < 3 ? 0xFFD700 : 0xFFFFFF;
                room.sendAnnouncement(`${index + 1}. ${entry.name} - ${entry.goals}`, player.id, color, index < 3 ? "bold" : "normal");
            });
        }
    },
    {
        name: "assist",
        description: "show TOP 8 players with the most assists",
        emoji: "👟",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const top = await getTopPlayersByStat("assists", 8);
            room.sendAnnouncement("👟 --- TOP 8 ASSISTS --- 👟", player.id, 0xFFFF00, "bold");
            if (!top || top.length === 0) {
                room.sendAnnouncement("No players found yet.", player.id, 0xFFFFFF, "normal");
                return;
            }
            top.forEach((entry, index) => {
                const color = index < 3 ? 0xFFD700 : 0xFFFFFF;
                room.sendAnnouncement(`${index + 1}. ${entry.name} - ${entry.assists}`, player.id, color, index < 3 ? "bold" : "normal");
            });
        }
    },
    {
        name: "help",
        description: "show the list of commands",
        emoji: "❓",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            room.sendAnnouncement("❓ --- COMMANDS --- ❓", player.id, 0xFFFF00, "bold");
            commands.forEach((command) => {
                if (command.adminOnly && !player.admin) return;
                room.sendAnnouncement(`${command.emoji} !${command.name}: ${command.description}`, player.id, 0xFFFFFF, "normal");
            });
        }
    },
    {
        name: "rules",
        description: "Show server rules",
        emoji: "📜",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            room.sendAnnouncement("💎 SERVER RULES 💎", player.id, 0xFFFF00, "bold");
            room.sendAnnouncement("1_ 🚫 No Spamming: Do not flood or repeat messages in chat.", player.id, 0xFFFFFF, "bold");
            room.sendAnnouncement("2_ 🤝 Respect Everyone: Respect all players. No toxic behavior.", player.id, 0xFFFFFF, "bold");
            room.sendAnnouncement("3_ 🚷 No Insults: Insults, racism, or offensive language are not allowed.", player.id, 0xFFFFFF, "bold");
            room.sendAnnouncement("4_ ⚽ Fair Play Only: No cheating, exploiting, or unfair advantages.", player.id, 0xFFFFFF, "bold");
            room.sendAnnouncement("5_ 🔄 No AFK Abuse: Do not stay AFK just to avoid being kicked.", player.id, 0xFFFFFF, "bold");
            room.sendAnnouncement("6_ 📢 Follow Admins: Always listen to admins and follow their decisions.", player.id, 0xFFFFFF, "bold");
            room.sendAnnouncement("7_ 🚨 No Toxic Behavior: Toxicity will result in warnings or bans.", player.id, 0xFFFFFF, "bold");
            room.sendAnnouncement("💎 ENJOY & HAVE FUN 💎", player.id, 0x00FF00, "bold");
        }
    },
    {
        name: "afk",
        description: "Mark yourself as AFK",
        emoji: "💤",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            // 1) AFK Command behavior as requested
            if (player.team !== 0) {
                // If player is in a team (Red/Blue), block command
                room.sendAnnouncement("❌ Impossible! You cannot go AFK during a match", player.id, 0xFF0000, "bold");
                return;
            }

            // If player is in spectators (team 0)
            if (isPlayerAfk(player.id)) {
                // If already AFK, inform the user
                room.sendAnnouncement("✅ You are already AFK", player.id, 0x00FF00, "bold");
            } else {
                // Mark player as AFK and send message
                setPlayerAfk(player.id);
                room.sendAnnouncement("😴 You are now AFK", player.id, 0xFFFF00, "bold");
                // Optional global announcement if desired, but request asked for specific message to player
            }
        }
    },
    {
        name: "afklist",
        description: "Show the list of AFK players",
        emoji: "📝",
        adminOnly: false,
        response: async (player: PlayerObject) => {
            const afkNames = getAfkPlayerNames();
            if (afkNames.length === 0) {
                room.sendAnnouncement("AFK Players: None", player.id, 0x00FF00, "bold");
                return;
            }
            room.sendAnnouncement(`📝 AFK Players (${afkNames.length}):`, player.id, 0xFFFF00, "bold");
            afkNames.forEach((name) => room.sendAnnouncement(`- ${name}`, player.id, 0xFFFFFF, "normal"));
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
     },
    {
        name: "random",
        description: "randomly select players from remaining spectators",
        emoji: "🎲",
        adminOnly: true,
        response: async (player: PlayerObject, args: string[]) => {
            const specs = getQueueList();
            // Requirement: exclude the first one already reserved for auto-pick
            const availableSpecs = specs.slice(1); 
            
            if (availableSpecs.length === 0) {
                room.sendAnnouncement("⚠️ No available spectators for random selection (excluding reserved #1).", player.id, 0xFF0000, "bold");
                return;
            }

            const count = args.length > 0 ? parseInt(args[0]!) : 1;
            if (isNaN(count) || count <= 0) {
                room.sendAnnouncement("⚠️ Invalid count for random selection.", player.id, 0xFF0000, "bold");
                return;
            }

            const shuffled = availableSpecs.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, count);

            selected.forEach(target => {
                const redCount = room.getPlayerList().filter(p => p.team === 1).length;
                const blueCount = room.getPlayerList().filter(p => p.team === 2).length;
                const targetTeamId = redCount <= blueCount ? 1 : 2;
                movePlayerToTeam(target.id, targetTeamId);
                room.sendAnnouncement(`🎲 Random: ${target.name} moved to ${targetTeamId === 1 ? "Red" : "Blue"}.`, player.id, 0x00FF00, "bold");
            });

            // Check if match can start after random assignment
            applyPlayerCountLogic();
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
