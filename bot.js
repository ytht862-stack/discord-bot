const { 
    Client, GatewayIntentBits, Events, EmbedBuilder, 
    REST, Routes, SlashCommandBuilder,
    StringSelectMenuBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//              הגדרות
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TOKEN            = process.env.TOKEN;
const CLIENT_ID        = '1459985778519183636';
const ALLOWED_USERS    = ['1425695670475685998'];
const HELPER_ROLE_NAME = 'helper';
const VERIFY_ROLE_NAME = 'Member';
const VERIFY_CHANNEL   = 'אימות';
const COINS_FILE       = './coins.json';
const XP_FILE          = './xp.json';
const STAFF_ROLE_NAMES = ['helper'];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  טיקטים
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TICKET_OPTIONS = [
    { label: 'כתוב כאן שם 1', description: 'כתוב כאן תיאור 1', value: 'option_1' },
    { label: 'כתוב כאן שם 2', description: 'כתוב כאן תיאור 2', value: 'option_2' },
    { label: 'כתוב כאן שם 3', description: 'כתוב כאן תיאור 3', value: 'option_3' },
    { label: 'כתוב כאן שם 4', description: 'כתוב כאן תיאור 4', value: 'option_4' },
    { label: 'כתוב כאן שם 5', description: 'כתוב כאן תיאור 5', value: 'option_5' },
];

const TICKET_EMBED_TITLE       = 'Support';
const TICKET_EMBED_DESCRIPTION = 'Anyone who wants to open a ticket can click here below and open a good day';
const TICKET_EMBED_FOOTER      = 'Powered by Ticket King';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  אוטומוד
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ALLOWED_LINK_CHANNELS = [];
const SPAM_LIMIT  = 5;
const SPAM_WINDOW = 5000;
const spamTracker = new Map();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  מטבעות
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function loadCoins() {
    try {
        if (fs.existsSync(COINS_FILE))
            return new Map(Object.entries(JSON.parse(fs.readFileSync(COINS_FILE, 'utf8'))));
    } catch (err) { console.error('Error loading coins:', err); }
    return new Map();
}
function saveCoins() {
    try { fs.writeFileSync(COINS_FILE, JSON.stringify(Object.fromEntries(coins), null, 2)); }
    catch (err) { console.error('Error saving coins:', err); }
}
const coins = loadCoins();
function getCoins(userId) { return coins.get(userId) || 0; }
function addCoins(userId, amount) { coins.set(userId, getCoins(userId) + amount); saveCoins(); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  מערכת XP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const XP_PER_MESSAGE      = 15;
const XP_COOLDOWN_MS      = 60 * 1000;
const XP_PER_VOICE_TICK   = 10;
const VOICE_TICK_INTERVAL = 5 * 60 * 1000;

const xpCooldowns = new Map();

function loadXP() {
    try {
        if (fs.existsSync(XP_FILE))
            return new Map(Object.entries(JSON.parse(fs.readFileSync(XP_FILE, 'utf8'))));
    } catch (err) { console.error('Error loading XP:', err); }
    return new Map();
}
function saveXP() {
    try { fs.writeFileSync(XP_FILE, JSON.stringify(Object.fromEntries(xpData), null, 2)); }
    catch (err) { console.error('Error saving XP:', err); }
}
const xpData = loadXP();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  נוסחת XP — הולכת וקשה יותר
//  סה"כ XP לרמה N = 50 × N × (N+1)
//  רמה 1  = 100 XP   | רמה 5  = 1,500 XP
//  רמה 10 = 5,500 XP | רמה 20 = 21,000 XP
//  רמה 50 = 127,550 XP (אין מכסה!)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function totalXPForLevel(n) { return 50 * n * (n + 1); }
function calcLevel(xp)      { return Math.floor((-1 + Math.sqrt(1 + (2 * xp) / 25)) / 2); }
function xpForCurrentLevel(level) { return totalXPForLevel(level); }
function xpForNextLevel(level)    { return totalXPForLevel(level + 1); }

function getXP(userId) { return xpData.get(userId) || 0; }

function addXP(userId, amount) {
    const oldXP    = getXP(userId);
    const oldLevel = calcLevel(oldXP);
    xpData.set(userId, oldXP + amount);
    saveXP();
    const newLevel = calcLevel(oldXP + amount);
    return { leveledUp: newLevel > oldLevel, newLevel };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  שאלות חשבון
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateQuestion() {
    const types = ['+', '-', '*'];
    const type  = types[Math.floor(Math.random() * types.length)];
    let a, b, answer, question;
    if (type === '+') { a = Math.floor(Math.random() * 50) + 1; b = Math.floor(Math.random() * 50) + 1; answer = a + b; question = `${a} + ${b}`; }
    else if (type === '-') { a = Math.floor(Math.random() * 50) + 10; b = Math.floor(Math.random() * a) + 1; answer = a - b; question = `${a} - ${b}`; }
    else { a = Math.floor(Math.random() * 10) + 1; b = Math.floor(Math.random() * 10) + 1; answer = a * b; question = `${a} x ${b}`; }
    return { question, answer };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Slash Commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const commands = [
    new SlashCommandBuilder().setName('play').setDescription('שחק שאלת חשבון וקבל 25 מטבעות!'),
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('בדוק את הפרופיל שלך')
        .addSubcommand(sub =>
            sub.setName('coins').setDescription('בדוק כמה מטבעות יש לך'))
        .addSubcommand(sub =>
            sub.setName('rank').setDescription('בדוק את ה xp שלך ')
                .addUserOption(opt =>
                    opt.setName('user').setDescription('משתמש לבדיקה (אופציונלי)').setRequired(false))),
    new SlashCommandBuilder().setName('top').setDescription('ראה את טבלת המובילים'),
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('בדוק את הרנק וה-XP שלך')
        .addUserOption(option => option.setName('user').setDescription('משתמש לבדיקה (אופציונלי)').setRequired(false)),
    new SlashCommandBuilder().setName('ticket').setDescription('שלח את תפריט הטיקטים (מורשים בלבד)'),
    new SlashCommandBuilder().setName('verify').setDescription('שלח את הודעת הווריפיקציה (מורשים בלבד)'),
    new SlashCommandBuilder()
        .setName('addcoins')
        .setDescription('הוסף מטבעות למשתמש (מורשים בלבד)')
        .addUserOption(option => option.setName('user').setDescription('המשתמש').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('כמות מטבעות').setRequired(true)),
].filter((cmd, i, arr) => arr.findIndex(c => c.name === cmd.name) === i)
 .map(cmd => cmd.toJSON());

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  הפעלת הבוט
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

client.once(Events.ClientReady, async c => {
    console.log(`✅ Bot is online! Logged in as ${c.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash Commands registered!');
    } catch (error) { console.error('Error registering commands:', error); }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //  טיימר XP לוויס — כל 5 דקות
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    setInterval(() => {
        for (const guild of client.guilds.cache.values()) {
            for (const [, member] of guild.members.cache) {
                if (
                    member.voice.channel &&
                    !member.user.bot &&
                    !member.voice.selfMute &&
                    !member.voice.selfDeaf
                ) {
                    const { leveledUp, newLevel } = addXP(member.id, XP_PER_VOICE_TICK);
                    if (leveledUp) {
                        const ch = guild.channels.cache.find(
                            c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
                        );
                        if (ch) ch.send({ embeds: [
                            new EmbedBuilder().setColor('#FFD700')
                                .setTitle('🎉 עלית ברמה!')
                                .setDescription(`${member} עלית לרמה **${newLevel}** בזכות הזמן בוויס! 🎙️`)
                                .setTimestamp()
                        ]}).catch(() => {});
                    }
                }
            }
        }
    }, VOICE_TICK_INTERVAL);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  הודעות
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const msg     = message.content.trim();
    const channel = message.channel;

    // ━━ בדיקת ספאם ━━
    if (!ALLOWED_USERS.includes(message.author.id)) {
        const now   = Date.now();
        const times = (spamTracker.get(message.author.id) || []).filter(t => now - t < SPAM_WINDOW);
        times.push(now);
        spamTracker.set(message.author.id, times);

        if (times.length >= SPAM_LIMIT) {
            spamTracker.delete(message.author.id);
            try {
                await message.member.timeout(60 * 1000, 'spam');
                const fetched  = await channel.messages.fetch({ limit: 50 });
                const toDelete = fetched.filter(m => m.author.id === message.author.id);
                await channel.bulkDelete(toDelete, true);
            } catch (err) { console.error('Error in spam timeout:', err); }
            return;
        }
    }

    // ━━ בדיקת GIF/קישורים ━━
    const hasLink = /https?:\/\/\S+/i.test(message.content);
    const hasGif  = message.attachments.some(a => a.contentType && a.contentType.includes('gif')) ||
                    /tenor\.com|giphy\.com/i.test(message.content);

    if ((hasLink || hasGif) && !ALLOWED_USERS.includes(message.author.id) && !ALLOWED_LINK_CHANNELS.includes(channel.name)) {
        try {
            await message.delete();
            await message.member.timeout(60 * 1000, 'gif or link');
            const warn = await channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🚫 אסור לשלוח GIF או קישורים!')
                    .setDescription(`${message.author} קיבלת טיים אווט של **דקה**.`)
                    .setTimestamp()]
            });
            setTimeout(async () => { try { await warn.delete(); } catch (e) {} }, 8000);
        } catch (err) { console.error('Error in automod:', err); }
        return;
    }

    // ━━ XP מהודעות (עם קולדאון) ━━
    if (!message.author.bot) {
        const now     = Date.now();
        const lastMsg = xpCooldowns.get(message.author.id) || 0;
        if (now - lastMsg >= XP_COOLDOWN_MS) {
            xpCooldowns.set(message.author.id, now);
            const { leveledUp, newLevel } = addXP(message.author.id, XP_PER_MESSAGE);
            if (leveledUp) {
                const lvlMsg = await channel.send({ embeds: [
                    new EmbedBuilder().setColor('#FFD700')
                        .setTitle('🎉 עלית ברמה!')
                        .setDescription(`${message.author} עלית לרמה **${newLevel}** בזכות הפעילות בצ'אט! 💬`)
                        .setTimestamp()
                ]});
                setTimeout(async () => { try { await lvlMsg.delete(); } catch (e) {} }, 10000);
            }
        }
    }

    // ━━ !h ━━
    if (msg.toLowerCase() === '!h') {
        if (!ALLOWED_USERS.includes(message.author.id)) return channel.send('❌ אין לך הרשאה!');
        const helperRole = message.guild.roles.cache.find(r => r.name === HELPER_ROLE_NAME);
        if (!helperRole) return channel.send(`❌ הרול "${HELPER_ROLE_NAME}" לא נמצא!`);
        const voiceValue = message.member.voice.channel ? message.member.voice.channel.name : 'לא נמצא בחדר וויס';
        try { await message.delete(); } catch (err) {}
        const question = await channel.send(`${message.author} מה הסיבה לפנייה? (יש לך 60 שניות)`);
        const filter   = m => m.author.id === message.author.id;
        try {
            const collected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
            const reason    = collected.first().content;
            try { await collected.first().delete(); } catch (err) {}
            try { await question.delete(); } catch (err) {}
            const roleMention = `<@&${helperRole.id}>`;
            await channel.send({ content: roleMention, embeds: [
                new EmbedBuilder().setColor('#99AAB5').setTitle('עזרה מצוות')
                    .addFields(
                        { name: 'אחראי:', value: roleMention, inline: false },
                        { name: 'סיבה:', value: reason, inline: false },
                        { name: 'חדר וויס:', value: voiceValue, inline: false }
                    )
                    .setDescription('תמתין בסבלנות, הצוות יענה לך הכי מהר שהם יכולים!')
                    .setFooter({ text: `פנייה על ידי ${message.author.tag}` })
                    .setTimestamp()
            ]});
        } catch (err) {
            try { await question.delete(); } catch (e) {}
            const t = await channel.send(`${message.author} לא ענית בזמן! הפקודה בוטלה.`);
            setTimeout(async () => { try { await t.delete(); } catch (e) {} }, 5000);
        }
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  פונקציה משותפת להצגת רנק
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function showRank(interaction, target) {
    const totalXP   = getXP(target.id);
    const level     = calcLevel(totalXP);
    const curFloor  = xpForCurrentLevel(level);
    const nextFloor = xpForNextLevel(level);
    const currentXP = totalXP - curFloor;
    const neededXP  = nextFloor - curFloor;

    const filled      = Math.min(10, Math.round((currentXP / neededXP) * 10));
    const progressBar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    const sorted = [...xpData.entries()].sort((a, b) => b[1] - a[1]);
    const rank   = sorted.findIndex(([id]) => id === target.id) + 1;

    await interaction.reply({ embeds: [
        new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`⭐ rank של ${target.displayName || target.username}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '✨ סה\"כ XP', value: `**${totalXP}**`,                         inline: true },
                { name: '🏆 דירוג',    value: rank > 0 ? `**#${rank}**` : '**-**',        inline: true },
                { name: '🏅 רמה',      value: `**${level}**`,                              inline: true },
                { name: `📊 התקדמות לרמה ${level + 1}`,
                  value: `\`${progressBar}\`\n**${currentXP} / ${neededXP} XP**`,      inline: false }
            )
            .setFooter({ text: `💬 הודעות: ${XP_PER_MESSAGE} XP | 🎙️ וויס: ${XP_PER_VOICE_TICK} XP/5 דקות` })
            .setTimestamp()
    ]});
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Interactions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

client.on(Events.InteractionCreate, async interaction => {

    if (interaction.isChatInputCommand()) {
        const { commandName, user, channel, guild } = interaction;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  /rank (פקודה עצמאית)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (commandName === 'rank') {
            const target    = interaction.options.getUser('user') || user;
            const totalXP   = getXP(target.id);
            const level     = calcLevel(totalXP);
            const curFloor  = xpForCurrentLevel(level);
            const nextFloor = xpForNextLevel(level);
            const currentXP = totalXP - curFloor;
            const neededXP  = nextFloor - curFloor;
            const filled      = Math.min(10, Math.round((currentXP / neededXP) * 10));
            const progressBar = '█'.repeat(filled) + '░'.repeat(10 - filled);
            await interaction.reply({ embeds: [
                new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle(`⭐ ${target.displayName || target.username}`)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setDescription(`רמה **${level}**\n\`${progressBar}\`\n${currentXP} / ${neededXP} XP`)
                    .setFooter({ text: `סה"כ XP: ${totalXP}` })
            ]});
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        //  /profile coins | /profile rank
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        else if (commandName === 'profile') {
            const sub = interaction.options.getSubcommand();

            if (sub === 'coins') {
                await interaction.reply({ embeds: [
                    new EmbedBuilder().setColor('#99AAB5')
                        .setTitle(`💰 הפרופיל של ${user.displayName}`)
                        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                        .addFields({ name: '🪙 מטבעות', value: `${getCoins(user.id)}`, inline: true })
                        .setTimestamp()
                ]});
            }

            else if (sub === 'rank') {
                const target = interaction.options.getUser('user') || user;
                await showRank(interaction, target);
            }
        }

        else if (commandName === 'verify') {
            if (!ALLOWED_USERS.includes(user.id))
                return interaction.reply({ content: '❌ אין לך הרשאה!', flags: 64 });
            const verifyChannel = guild.channels.cache.find(ch => ch.name === VERIFY_CHANNEL);
            if (!verifyChannel)
                return interaction.reply({ content: `❌ ערוץ "${VERIFY_CHANNEL}" לא נמצא!`, flags: 64 });
            const button = new ButtonBuilder().setCustomId('verify_button').setLabel('✅ אמת את עצמך').setStyle(ButtonStyle.Success);
            await verifyChannel.send({
                embeds: [new EmbedBuilder().setColor('#99AAB5')
                    .setTitle(`ברוכים הבאים לשרת ${guild.name}!`)
                    .setDescription('לחץ על הכפתור למטה כדי לאמת את עצמך ולקבל גישה לשרת')
                    .setTimestamp()],
                components: [new ActionRowBuilder().addComponents(button)]
            });
            await interaction.reply({ content: `✅ הודעת האימות נשלחה ל־${verifyChannel}!`, flags: 64 });
        }

        else if (commandName === 'ticket') {
            if (!ALLOWED_USERS.includes(user.id))
                return interaction.reply({ content: '❌ אין לך הרשאה!', flags: 64 });
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select').setPlaceholder('Select an option').addOptions(TICKET_OPTIONS);
            await channel.send({
                embeds: [new EmbedBuilder().setColor('#99AAB5').setTitle(TICKET_EMBED_TITLE)
                    .setDescription(TICKET_EMBED_DESCRIPTION).setFooter({ text: TICKET_EMBED_FOOTER }).setTimestamp()],
                components: [new ActionRowBuilder().addComponents(selectMenu)]
            });
            await interaction.reply({ content: '✅ תפריט הטיקטים נשלח!', flags: 64 });
        }

        else if (commandName === 'play') {
            const { question, answer } = generateQuestion();
            await interaction.reply({ embeds: [
                new EmbedBuilder().setColor('#99AAB5').setTitle('🧮 שאלת חשבון!')
                    .setDescription(`**כמה זה ${question}?**\n\nיש לך 30 שניות לענות!`)
                    .setFooter({ text: 'כתוב את התשובה בצ\'אט' }).setTimestamp()
            ]});
            const filter = m => m.author.id === user.id && !isNaN(m.content.trim());
            try {
                const collected  = await channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
                const userAnswer = parseInt(collected.first().content.trim());
                try { await collected.first().delete(); } catch (e) {}
                if (userAnswer === answer) {
                    addCoins(user.id, 25);
                    await channel.send({ embeds: [new EmbedBuilder().setColor('#99AAB5').setTitle('✅ נכון!')
                        .setDescription(`${user} ענה נכון!\n\n**${question} = ${answer}**\n\n🪙 קיבלת **25 מטבעות!**\nסה"כ: **${getCoins(user.id)} מטבעות**`).setTimestamp()]});
                } else {
                    await channel.send({ embeds: [new EmbedBuilder().setColor('#99AAB5').setTitle('❌ טעות!')
                        .setDescription(`${user} ענה לא נכון!\n\n**${question} = ${answer}**`).setTimestamp()]});
                }
            } catch (err) {
                await channel.send({ embeds: [new EmbedBuilder().setColor('#99AAB5').setTitle('⏱️ נגמר הזמן!')
                    .setDescription(`${user} לא ענה בזמן!\n\n**התשובה הייתה: ${answer}**`).setTimestamp()]});
            }
        }

        else if (commandName === 'top') {
            if (coins.size === 0) return interaction.reply('❌ אין עדיין שחקנים!');
            const sorted      = [...coins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
            const medals      = ['🥇', '🥈', '🥉'];
            const description = sorted.map(([userId, amount], i) =>
                `${medals[i] || `**${i + 1}.**`} <@${userId}> — **${amount} מטבעות**`
            ).join('\n');
            await interaction.reply({ embeds: [
                new EmbedBuilder().setColor('#99AAB5').setTitle('🏆 טבלת המובילים')
                    .setDescription(description).setTimestamp()
            ]});
        }

        else if (commandName === 'addcoins') {
            if (!ALLOWED_USERS.includes(user.id))
                return interaction.reply({ content: '❌ אין לך הרשאה!', flags: 64 });
            const targetUser = interaction.options.getUser('user');
            const amount     = interaction.options.getInteger('amount');
            if (amount <= 0)
                return interaction.reply({ content: '❌ הכמות חייבת להיות חיובית!', flags: 64 });
            addCoins(targetUser.id, amount);
            await interaction.reply({ embeds: [
                new EmbedBuilder().setColor('#99AAB5').setTitle('🪙 מטבעות נוספו!')
                    .setDescription(`נוספו **${amount} מטבעות** ל־${targetUser}\n\nסה"כ כעת: **${getCoins(targetUser.id)} מטבעות**`)
                    .setTimestamp()
            ]});
        }
    }

    else if (interaction.isButton() && interaction.customId === 'verify_button') {
        try {
            const memberRole = interaction.guild.roles.cache.find(r => r.name === VERIFY_ROLE_NAME);
            if (!memberRole)
                return interaction.reply({ content: `❌ הרול "${VERIFY_ROLE_NAME}" לא נמצא!`, flags: 64 });
            if (interaction.member.roles.cache.has(memberRole.id))
                return interaction.reply({ content: '✅ כבר אומתת!', flags: 64 });
            await interaction.member.roles.add(memberRole);
            await interaction.reply({ content: `✅ אומתת בהצלחה! ברוך הבא לשרת ${interaction.guild.name}!`, flags: 64 });
        } catch (error) {
            console.error('Error verifying:', error);
            await interaction.reply({ content: '❌ שגיאה באימות, נסה שוב.', flags: 64 });
        }
    }

    else if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        try {
            const selectedOption = TICKET_OPTIONS.find(o => o.value === interaction.values[0]);
            const ticketName     = selectedOption ? selectedOption.label : interaction.values[0];
            const member         = interaction.member;

            const existingTicket = interaction.guild.channels.cache.find(
                ch => ch.name === `ticket-${member.user.username.toLowerCase()}`
            );
            if (existingTicket)
                return interaction.reply({ content: `❌ כבר יש לך טיקט פתוח: ${existingTicket}`, flags: 64 });

            await interaction.reply({ content: '🎫 יוצר טיקט...', flags: 64 });

            const staffRoles = STAFF_ROLE_NAMES
                .map(name => interaction.guild.roles.cache.find(r => r.name === name))
                .filter(r => r);

            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${member.user.username}`,
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    ...staffRoles.map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
                ]
            });

            const closeButton   = new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger);
            const staffMentions = staffRoles.map(r => `<@&${r.id}>`).join(' ');

            await ticketChannel.send({
                content: `${member} ${staffMentions}`,
                components: [new ActionRowBuilder().addComponents(closeButton)],
                embeds: [new EmbedBuilder().setColor('#99AAB5').setTitle(`🎫 ${ticketName}`)
                    .setDescription(`Hey ${member}!\n\n**Ticket Type:** ${ticketName}\n\nPlease describe your issue and a staff member will be with you shortly!`)
                    .setTimestamp()]
            });

            await interaction.editReply({ content: `✅ הטיקט נוצר! ${ticketChannel}` });
        } catch (error) {
            console.error('Error creating ticket:', error);
            try { await interaction.editReply({ content: '❌ שגיאה ביצירת הטיקט!' }); } catch (e) {}
        }
    }

    else if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const confirmButton = new ButtonBuilder().setCustomId('confirm_close').setLabel('✅ Yes, Close').setStyle(ButtonStyle.Success);
        const cancelButton  = new ButtonBuilder().setCustomId('cancel_close').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary);
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor('#99AAB5').setTitle('⚠️ Close Ticket?')
                .setDescription('Are you sure you want to close this ticket?').setTimestamp()],
            components: [new ActionRowBuilder().addComponents(cancelButton, confirmButton)],
            flags: 64
        });
    }

    else if (interaction.isButton() && interaction.customId === 'confirm_close') {
        const ch = interaction.channel;
        await interaction.update({ content: '🔒 Closing in 3 seconds...', embeds: [], components: [] });
        setTimeout(async () => { try { await ch.delete(); } catch (err) {} }, 3000);
    }

    else if (interaction.isButton() && interaction.customId === 'cancel_close') {
        await interaction.update({ content: '✅ Cancelled.', embeds: [], components: [] });
    }
});

client.login(process.env.TOKEN);
