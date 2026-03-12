// src/ai/chat.js

const { SYSTEM_PROMPT } = require('./systemPrompt');
const logger = require('../utils/logger');

// ── In-memory chat history (per user) ──
const chatMemory = {};

// Config
const MAX_HISTORY = 20;       // Max messages per user (system + user + assistant)
const API_TIMEOUT = 30000;    // 30 second timeout for AI calls
const MAX_RETRIES = 2;        // Retry failed API calls

// ── Rate limiter (simple per-user) ──
const rateLimits = {};
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 15;       // Max 15 messages per minute per user

function isRateLimited(userId) {
    const now = Date.now();
    if (!rateLimits[userId]) {
        rateLimits[userId] = { count: 1, windowStart: now };
        return false;
    }

    const rl = rateLimits[userId];
    if (now - rl.windowStart > RATE_LIMIT_WINDOW) {
        // Reset window
        rl.count = 1;
        rl.windowStart = now;
        return false;
    }

    rl.count++;
    return rl.count > RATE_LIMIT_MAX;
}

// ── Fetch with timeout ──
async function fetchWithTimeout(url, options, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

// ── Main AI response function ──
async function getAIResponse(userMessage, userId, userName = 'Customer') {
    // Rate limit check
    if (isRateLimited(userId)) {
        return "Ek minute mein bahut saare messages aa gaye! 😊 Thoda ruk ke bhejiye, main yahan hoon.";
    }

    // Initialize chat memory for new user
    if (!chatMemory[userId]) {
        chatMemory[userId] = [
            { role: 'system', content: SYSTEM_PROMPT },
        ];
        logger.info(`New conversation started: ${userId.split('@')[0]}`);
    }

    // Add user message to history
    chatMemory[userId].push({ role: 'user', content: userMessage });

    // Trim history if too long (keep system prompt + recent messages)
    if (chatMemory[userId].length > MAX_HISTORY) {
        chatMemory[userId] = [
            chatMemory[userId][0],                          // System prompt
            ...chatMemory[userId].slice(-(MAX_HISTORY - 1)) // Recent messages
        ];
    }

    // ── Model fallback chain ──
    // If primary model fails, try the next one
    const MODELS = [
        process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',   // Primary: best for Hindi+English chat
        process.env.AI_MODEL_FALLBACK || 'meta-llama/llama-4-maverick:free', // Fallback 1: strong instruction following
        'openrouter/free',                                                    // Fallback 2: auto-picks any available free model
    ];

    // Call AI with retry + model fallback
    for (let modelIdx = 0; modelIdx < MODELS.length; modelIdx++) {
        const currentModel = MODELS[modelIdx];

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetchWithTimeout(
                    'https://openrouter.ai/api/v1/chat/completions',
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                            'Content-Type': 'application/json',
                            'HTTP-Referer': process.env.RENDER_EXTERNAL_HOSTNAME 
                                ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` 
                                : 'https://grihsansar.com',
                            'X-Title': 'GRIH SANSAR REE Bot',
                        },
                        body: JSON.stringify({
                            model: currentModel,
                            messages: chatMemory[userId],
                            temperature: 0.7,
                            max_tokens: 1024,
                        }),
                    }
                );

            if (!response.ok) {
                const errorBody = await response.text();
                logger.error(`OpenRouter [${currentModel}] error (attempt ${attempt}): ${response.status} — ${errorBody}`);
                
                if (response.status === 429) {
                    // Rate limited — wait and retry
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                if (attempt === MAX_RETRIES) break; // Try next model
                continue;
            }

            const data = await response.json();

            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                const aiReply = data.choices[0].message.content;
                
                // Save assistant response to memory
                chatMemory[userId].push({ role: 'assistant', content: aiReply });
                
                if (modelIdx > 0) logger.info(`Used fallback model: ${currentModel}`);
                logger.debug(`AI response for ${userId.split('@')[0]}: ${aiReply.substring(0, 100)}...`);
                return aiReply;
            } else {
                logger.error('Unexpected API response format:', JSON.stringify(data).substring(0, 200));
                if (attempt === MAX_RETRIES) break; // Try next model
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error(`AI request timeout [${currentModel}] (attempt ${attempt})`);
            } else {
                logger.error(`AI request failed [${currentModel}] (attempt ${attempt}):`, error.message);
            }

            if (attempt === MAX_RETRIES) break; // Try next model
            
            // Wait before retry
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
        } // end retry loop

        logger.warn(`Model ${currentModel} failed — trying next fallback...`);
    } // end model fallback loop

    // All models failed
    return "I'm having a small hiccup at my end — could you send that again in a moment? I'll be right with you! 😊";
}

// ── Get user's chat history (for debugging) ──
function getChatHistory(userId) {
    return chatMemory[userId] || [];
}

// ── Clear user's chat history ──
function clearChatHistory(userId) {
    delete chatMemory[userId];
    logger.info(`Chat history cleared for ${userId.split('@')[0]}`);
}

// ── Periodic memory cleanup (users inactive for 24 hours) ──
const lastActivity = {};

function trackActivity(userId) {
    lastActivity[userId] = Date.now();
}

function cleanupInactiveChats() {
    const INACTIVE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    let cleaned = 0;

    for (const userId in chatMemory) {
        if (!lastActivity[userId] || now - lastActivity[userId] > INACTIVE_THRESHOLD) {
            delete chatMemory[userId];
            delete lastActivity[userId];
            delete rateLimits[userId];
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} inactive chat sessions.`);
    }
}

// Run cleanup every 6 hours
setInterval(cleanupInactiveChats, 6 * 60 * 60 * 1000);

module.exports = { 
    getAIResponse, 
    getChatHistory, 
    clearChatHistory, 
    trackActivity 
};
