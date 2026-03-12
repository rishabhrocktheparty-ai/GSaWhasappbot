// src/whatsapp/index.js

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { useSupabaseAuthState } = require('./authState');
const { getAIResponse, trackActivity, clearChatHistory } = require('../ai/chat');
const { markOutreachReplied, startDailyOutreach, stopOutreach } = require('../outreach/scheduler');
const logger = require('../utils/logger');

// ── Message processing queue (prevents race conditions) ──
const messageQueue = {};
let processingLock = {};

async function processMessageQueue(userId, sock) {
    if (processingLock[userId]) return;
    processingLock[userId] = true;

    try {
        while (messageQueue[userId] && messageQueue[userId].length > 0) {
            const { msg, textMessage, pushName } = messageQueue[userId].shift();
            await handleMessage(sock, msg, textMessage, pushName, userId);
        }
    } finally {
        processingLock[userId] = false;
    }
}

// ── Handle individual message ──
async function handleMessage(sock, msg, textMessage, pushName, userId) {
    try {
        // Track user activity for memory cleanup
        trackActivity(userId);

        // Track if this is a reply to an outreach message
        await markOutreachReplied(userId);

        // Admin commands (only work in groups)
        if (textMessage === '!getid') {
            await sock.sendMessage(userId, { text: `Group ID:\n*${userId}*` });
            return;
        }

        // Clear history command
        if (textMessage.toLowerCase() === '!reset') {
            clearChatHistory(userId);
            await sock.sendMessage(userId, { 
                text: "Fresh start! 😊 How can I help you today?\n\nYou can send me your grocery list, ask for recipe ideas, or say \"Reorder\" to repeat a past order.\n\n— REE, GRIH SANSAR" 
            });
            return;
        }

        // Get AI response
        const aiReply = await getAIResponse(textMessage, userId, pushName);

        if (!aiReply) {
            logger.error(`Empty AI response for ${userId.split('@')[0]}`);
            return;
        }

        // Check for order summary (split customer message from admin notification)
        if (aiReply.includes('===ORDER_SUMMARY===')) {
            const parts = aiReply.split('===ORDER_SUMMARY===');
            const customerMessage = parts[0].trim();
            const orderDetails = parts[1] ? parts[1].trim() : '';

            // Send clean message to customer
            await sock.sendMessage(userId, { text: customerMessage });

            // Send order notification to admin group
            const groupJid = process.env.OWNER_GROUP_JID;
            if (groupJid && orderDetails) {
                const customerPhone = userId.split('@')[0];
                const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                
                const groupMessage = [
                    `🚨 *NEW ORDER RECEIVED* 🚨`,
                    ``,
                    `👤 *Customer:* ${pushName || 'Unknown'}`,
                    `📱 *Phone:* +${customerPhone}`,
                    `🕐 *Time:* ${timestamp}`,
                    ``,
                    `🛒 *Order Details:*`,
                    orderDetails,
                    ``,
                    `━━━━━━━━━━━━━━━━━━`,
                    `GRIH SANSAR | "Think Before You Blink."`,
                ].join('\n');

                try {
                    await sock.sendMessage(groupJid, { text: groupMessage });
                    logger.info(`Order notification sent to admin group for ${customerPhone}`);
                } catch (err) {
                    logger.error('Failed to send order to admin group:', err.message);
                }
            }
        } else {
            // Normal message — send directly
            await sock.sendMessage(userId, { text: aiReply });
        }

        // Update message counter
        const { botState } = require('../../index');
        botState.messagesHandled++;

    } catch (error) {
        logger.error(`Error handling message from ${userId.split('@')[0]}:`, error.message);
        
        try {
            await sock.sendMessage(userId, { 
                text: "Oops, something went wrong at my end! Could you try sending that again? 😊" 
            });
        } catch (sendErr) {
            logger.error('Failed to send error message:', sendErr.message);
        }
    }
}

// ── Main WhatsApp connection ──
async function connectToWhatsApp() {
    const { botState } = require('../../index');

    try {
        const { state, saveCreds, clearSession } = await useSupabaseAuthState();
        const { version } = await fetchLatestBaileysVersion();

        logger.info(`Connecting with Baileys v${version.join('.')}`);
        botState.status = 'Connecting...';

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
            getMessage: async () => ({ conversation: 'hello' }),
            // Connection timeouts
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: undefined,
            keepAliveIntervalMs: 30000,
        });

        // ── Connection updates ──
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                botState.qr = qr;
                botState.status = 'Waiting for QR Scan';
                logger.info('New QR code generated — scan from WhatsApp.');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.output?.payload?.message || 'Unknown';

                logger.warn(`Connection closed: ${statusCode} — ${reason}`);
                botState.status = 'Reconnecting...';
                botState.qr = '';

                // Stop outreach until reconnected
                stopOutreach();

                if (statusCode === DisconnectReason.loggedOut) {
                    logger.warn('Logged out — clearing session and restarting.');
                    clearSession().then(() => {
                        setTimeout(() => connectToWhatsApp(), 5000);
                    });
                } else {
                    // Reconnect with exponential backoff
                    const delay = Math.min(5000 * (statusCode === 408 ? 2 : 1), 30000);
                    setTimeout(() => connectToWhatsApp(), delay);
                }
            }

            if (connection === 'open') {
                botState.qr = '';
                botState.status = 'Ready';
                botState.connectedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                logger.info('✅ REE is connected and ready!');

                // Start outreach system
                startDailyOutreach(sock);
            }
        });

        // ── Save credentials on update ──
        sock.ev.on('creds.update', saveCreds);

        // ── Message handler ──
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                // Skip if no message content or if sent by us
                if (!msg.message || msg.key.fromMe) continue;

                // Skip status broadcasts
                if (msg.key.remoteJid === 'status@broadcast') continue;

                const userId = msg.key.remoteJid;
                const pushName = msg.pushName || 'Customer';

                // Extract text from various message types
                let textMessage = null;

                // Regular text message
                if (msg.message.conversation) {
                    textMessage = msg.message.conversation;
                }
                // Extended text (replies, links, etc.)
                else if (msg.message.extendedTextMessage?.text) {
                    textMessage = msg.message.extendedTextMessage.text;
                }
                // Image with caption
                else if (msg.message.imageMessage) {
                    const caption = msg.message.imageMessage.caption;
                    if (caption) {
                        textMessage = `[Customer sent a photo with caption: "${caption}"] Please acknowledge you received a photo and process any grocery items mentioned in the caption.`;
                    } else {
                        textMessage = "[Customer sent a photo of what appears to be a grocery list] Please let them know you received their photo. Since image processing isn't available right now, politely ask them to type out the items or send a voice note instead.";
                    }
                }
                // Audio/voice message
                else if (msg.message.audioMessage) {
                    textMessage = "[Customer sent a voice message] Please let them know you received their voice note. Since voice processing isn't available right now, politely ask them to type out their grocery list instead. Be warm about it.";
                }
                // Document
                else if (msg.message.documentMessage) {
                    await sock.sendMessage(userId, { 
                        text: "I received your document! 📄 For grocery orders, it's easiest if you type out your list or send me a photo. I'll get your basket ready in no time! 😊" 
                    });
                    continue;
                }
                // Sticker or other media — ignore gracefully
                else if (msg.message.stickerMessage) {
                    continue; // Don't respond to stickers
                }
                // Contact card
                else if (msg.message.contactMessage || msg.message.contactsArrayMessage) {
                    continue; // Don't respond to contact shares
                }
                // Location
                else if (msg.message.locationMessage || msg.message.liveLocationMessage) {
                    await sock.sendMessage(userId, { 
                        text: "Thanks for sharing your location! 📍 I'll note this for delivery. Is there anything else you'd like to add to your order?" 
                    });
                    continue;
                }

                // If we extracted text, queue it for processing
                if (textMessage) {
                    if (!messageQueue[userId]) messageQueue[userId] = [];
                    messageQueue[userId].push({ msg, textMessage, pushName });
                    processMessageQueue(userId, sock);
                }
            }
        });

    } catch (error) {
        logger.error('Failed to connect to WhatsApp:', error.message);
        botState.status = 'Error — retrying in 10s';
        setTimeout(() => connectToWhatsApp(), 10000);
    }
}

module.exports = { connectToWhatsApp };
