const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
require("dotenv").config();

const commands = [
	new SlashCommandBuilder()
		.setName("setup-link")
		.setDescription("Post the permanent Link Account panel in this channel")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

	new SlashCommandBuilder()
		.setName("givecoins")
		.setDescription("Give coins to a linked player")
		.addUserOption(option =>
			option.setName("user").setDescription("Discord user").setRequired(true)
		)
		.addIntegerOption(option =>
			option.setName("amount").setDescription("Amount of coins").setRequired(true).setMinValue(1)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

	new SlashCommandBuilder()
		.setName("msg")
		.setDescription("Send a message to the Minecraft server")
		.addStringOption(option =>
			option.setName("message").setDescription("Message content").setRequired(true)
		)
		.addStringOption(option =>
			option.setName("target").setDescription("Player name or 'all'").setRequired(false)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

	new SlashCommandBuilder()
		.setName("checklink")
		.setDescription("Check if a Discord user is linked")
		.addUserOption(option =>
			option.setName("user").setDescription("Discord user").setRequired(false)
		)
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
	try {
		console.log("Deploying slash commands...");

		if (process.env.GUILD_ID) {
			await rest.put(
				Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
				{ body: commands }
			);
			console.log("Successfully deployed guild commands.");
		} else {
			await rest.put(
				Routes.applicationCommands(process.env.CLIENT_ID),
				{ body: commands }
			);
			console.log("Successfully deployed global commands.");
		}
	} catch (error) {
		console.error(error);
	}
})();
