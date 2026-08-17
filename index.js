const {
	Client,
	GatewayIntentBits,
	Partials,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	PermissionFlagsBits,
	Events
} = require("discord.js");
const fetch = require("node-fetch");
require("dotenv").config();

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages
	],
	partials: [Partials.Channel]
});

const API_URL = process.env.API_URL || "http://127.0.0.1:3847";
const API_SECRET = process.env.API_SECRET || "";

async function apiRequest(method, path, body = null) {
	const options = {
		method,
		headers: {
			"Content-Type": "application/json",
			"Authorization": API_SECRET,
			"X-API-Key": API_SECRET
		},
		timeout: 8000
	};

	if (body) {
		options.body = JSON.stringify(body);
	}

	const response = await fetch(`${API_URL}${path}`, options);
	const data = await response.json().catch(() => ({}));
	return { status: response.status, data };
}

client.once(Events.ClientReady, () => {
	console.log(`Logged in as ${client.user.tag}`);
	client.user.setActivity("Link your account | /discord", { type: 3 });
});

client.on(Events.InteractionCreate, async (interaction) => {
	try {
		if (interaction.isButton()) {
			if (interaction.customId === "link_account") {
				const modal = new ModalBuilder()
					.setCustomId("link_modal")
					.setTitle("Link Account");

				const codeInput = new TextInputBuilder()
					.setCustomId("linking_code")
					.setLabel("Linking Code")
					.setPlaceholder("Enter the 5-digit code you received in-game")
					.setStyle(TextInputStyle.Short)
					.setMinLength(4)
					.setMaxLength(8)
					.setRequired(true);

				modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
				await interaction.showModal(modal);
				return;
			}

			if (interaction.customId === "update_roles") {
				await interaction.deferReply({ ephemeral: true });
				const result = await apiRequest("GET", `/api/player/${interaction.user.id}`);

				if (result.status === 404 || !result.data.success) {
					await interaction.editReply({ content: "Your Discord account is not linked to any in-game account." });
					return;
				}

				await interaction.editReply({
					content: `Linked to **${result.data.player_name}**. Roles will be updated according to your rank system.`
				});
				return;
			}
		}

		if (interaction.isModalSubmit()) {
			if (interaction.customId === "link_modal") {
				await interaction.deferReply({ ephemeral: true });

				const code = interaction.fields.getTextInputValue("linking_code").trim();
				const discordTag = interaction.user.tag || interaction.user.username;

				const result = await apiRequest("POST", "/api/link", {
					code,
					discord_id: interaction.user.id,
					discord_tag: discordTag
				});

				if (result.data.success) {
					const embed = new EmbedBuilder()
						.setColor(0x57F287)
						.setTitle("Account Linked Successfully")
						.setDescription(`Your Discord account has been linked to **${result.data.player_name}**.`)
						.addFields(
							{ name: "Bonus", value: result.data.bonus > 0 ? `${result.data.bonus} coins` : "None", inline: true }
						)
						.setTimestamp();

					await interaction.editReply({ embeds: [embed] });
				} else {
					const messages = {
						invalid_code: "Invalid linking code.",
						expired: "This code has expired. Please generate a new one in-game using `/discord`.",
						discord_already_linked: "This Discord account is already linked to another player.",
						player_already_linked: "This Minecraft account is already linked.",
						database_error: "An internal error occurred. Please try again later."
					};
					await interaction.editReply({
						content: messages[result.data.message] || "Failed to link account. Please try again."
					});
				}
				return;
			}
		}

		if (interaction.isChatInputCommand()) {
			const { commandName } = interaction;

			if (commandName === "setup-link") {
				if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
					await interaction.reply({ content: "You need Administrator permission.", ephemeral: true });
					return;
				}

				const embed = new EmbedBuilder()
					.setColor(0x5865F2)
					.setTitle("Link Your Account")
					.setDescription(
						"You can get the perks below by linking your Discord account to your in-game account:\n\n" +
						"✅ Send messages and join voice channels.\n" +
						"🎨 Get your gamertag automatically synced.\n" +
						"👑 Get the roles of your ranks on Discord.\n\n" +
						"**How to link:**\n" +
						"1. Type `/discord` in-game.\n" +
						"2. Get the 5-digit code.\n" +
						"3. Click the button below and enter the code."
					)
					.setFooter({ text: "Having issues? Contact staff." });

				const row = new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId("link_account")
						.setLabel("Link Account")
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId("update_roles")
						.setLabel("Update Roles")
						.setStyle(ButtonStyle.Secondary)
				);

				await interaction.channel.send({ embeds: [embed], components: [row] });
				await interaction.reply({ content: "Link panel has been posted.", ephemeral: true });
				return;
			}

			if (commandName === "givecoins") {
				if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
					await interaction.reply({ content: "You need Administrator permission.", ephemeral: true });
					return;
				}

				const user = interaction.options.getUser("user", true);
				const amount = interaction.options.getInteger("amount", true);

				await interaction.deferReply({ ephemeral: true });

				const result = await apiRequest("POST", "/api/reward", {
					discord_id: user.id,
					amount,
					reason: `Given by ${interaction.user.tag}`
				});

				if (result.data.success) {
					await interaction.editReply({
						content: `Successfully gave **${amount}** coins to **${result.data.player}** (${user.tag}).`
					});
				} else {
					await interaction.editReply({
						content: `Failed: ${result.data.error || "Unknown error"}`
					});
				}
				return;
			}

			if (commandName === "msg") {
				if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
					await interaction.reply({ content: "You need Administrator permission.", ephemeral: true });
					return;
				}

				const message = interaction.options.getString("message", true);
				const target = interaction.options.getString("target") || "all";

				await interaction.deferReply({ ephemeral: true });

				const result = await apiRequest("POST", "/api/message", {
					message,
					target
				});

				if (result.data.success) {
					await interaction.editReply({ content: `Message sent to **${result.data.sent_to}**.` });
				} else {
					await interaction.editReply({ content: `Failed: ${result.data.error || "Unknown error"}` });
				}
				return;
			}

			if (commandName === "checklink") {
				const user = interaction.options.getUser("user") || interaction.user;
				await interaction.deferReply({ ephemeral: true });

				const result = await apiRequest("GET", `/api/player/${user.id}`);
				if (result.data.success) {
					await interaction.editReply({
						content: `**${user.tag}** is linked to **${result.data.player_name}** (UUID: \`${result.data.player_uuid}\`)`
					});
				} else {
					await interaction.editReply({ content: `**${user.tag}** is not linked.` });
				}
			}
		}
	} catch (error) {
		console.error("Interaction error:", error);
		const reply = { content: "An unexpected error occurred.", ephemeral: true };
		if (interaction.deferred || interaction.replied) {
			await interaction.followUp(reply).catch(() => {});
		} else {
			await interaction.reply(reply).catch(() => {});
		}
	}
});

client.login(process.env.DISCORD_TOKEN);
