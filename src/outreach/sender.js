// src/outreach/sender.js

// ============================================================
// Staggered Message Sender
// Sends messages with random delays between 9 AM – 8 PM IST
// NEVER sends all at once — spreads across the day
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

function getSupabase() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

/**
 * Get current hour in IST (0-23)
 */
function getISTHour() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);
    return ist.getUTCHours();
}

/**
 * Check if we're within sending hours (9 AM – 8 PM IST)
 */
function isWithinSendingHours() {
    const hour = getISTHour();
    const startHour = parseInt(process.env.OUTREACH_START_HOUR) || 9;
    const endHour = parseInt(process.env.OUTREACH_END_HOUR) || 20;
    return hour >= startHour && hour < endHour;
}

/**
 * Random delay between min and max milliseconds
 */
function randomDelay(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

/**
 * Sleep for given milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get ISO week number
 */
function getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 604800000;
    return Math.ceil((diff / oneWeek) + start.getDay() / 7);
}

/**
 * Log a sent message to outreach_log
 */
async function logOutreach(phone, category, templateId, messageText) {
    const supabase = getSupabase();
    try {
        await supabase.from('outreach_log').insert({
            phone,
            template_category: category,
            template_id: templateId,
            message_text: messageText,
            sent_at: new Date().toISOString(),
            week_number: getWeekNumber(),
            replied: false,
        });
    } catch (err) {
        logger.error(`Failed to log outreach for ${phone}:`, err.message);
    }
}

/**
 * Get phones already messaged this week
 */
async function getMessagedThisWeek() {
    const supabase = getSupabase();
    const weekNum = getWeekNumber();

    const { data, error } = await supabase
        .from('outreach_log')
        .select('phone')
        .eq('week_number', weekNum);

    if (error) {
        logger.error('Failed to fetch weekly outreach log:', error.message);
        return new Set();
    }

    return new Set((data || []).map(r => r.phone));
}

/**
 * Get phones messaged yesterday (no consecutive days)
 */
async function getMessagedYesterday() {
    const supabase = getSupabase();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('outreach_log')
        .select('phone')
        .gte('sent_at', yesterday.toISOString())
        .lt('sent_at', today.toISOString());

    if (error) {
        logger.error('Failed to fetch yesterday outreach:', error.message);
        return new Set();
    }

    return new Set((data || []).map(r => r.phone));
}

/**
 * Get last template category used for a customer
 */
async function getLastCategory(phone) {
    const supabase = getSupabase();
    const { data } = await supabase
        .from('outreach_log')
        .select('template_category, template_id')
        .eq('phone', phone)
        .order('sent_at', { ascending: false })
        .limit(3);

    if (!data || data.length === 0) return { lastCategory: null, lastTemplateIds: [] };

    return {
        lastCategory: data[0].template_category,
        lastTemplateIds: data.map(r => r.template_id),
    };
}

/**
 * Mark an outreach message as replied
 */
async function markReplied(phone) {
    const supabase = getSupabase();
    const weekNum = getWeekNumber();

    await supabase
        .from('outreach_log')
        .update({ replied: true })
        .eq('phone', phone)
        .eq('week_number', weekNum);
}

/**
 * Send a single WhatsApp message via the bot socket
 * Returns true on success, false on failure
 */
async function sendWhatsAppMessage(sock, phone, text) {
    const jid = `${phone}@s.whatsapp.net`;

    try {
        // Check if number exists on WhatsApp
        const [result] = await sock.onWhatsApp(jid);
        if (!result || !result.exists) {
            logger.warn(`Phone ${phone} not on WhatsApp — skipping`);
            return false;
        }

        await sock.sendMessage(result.jid, { text });
        logger.debug(`Outreach sent to ${phone}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send outreach to ${phone}:`, err.message);
        return false;
    }
}

/**
 * Send today's batch of messages with staggered delays
 * This is the main sending loop
 */
async function sendBatch(sock, batch, pickTemplateFn, personaliseTemplateFn) {
    let sent = 0;
    let failed = 0;

    logger.info(`Starting outreach batch: ${batch.length} messages to send`);

    for (let i = 0; i < batch.length; i++) {
        // Stop if outside sending hours
        if (!isWithinSendingHours()) {
            logger.warn(`Outside sending hours — pausing. ${batch.length - i} messages remaining for tomorrow.`);
            break;
        }

        const customer = batch[i];
        const phone = customer.phone;

        try {
            // Get last category to ensure variety
            const { lastCategory, lastTemplateIds } = await getLastCategory(phone);

            // Pick template
            const { category, template } = pickTemplateFn(lastCategory, lastTemplateIds);

            // Personalise
            const messageText = personaliseTemplateFn(template.text, {
                name: customer.name,
                lastItem1: customer.last_items ? customer.last_items.split(',')[0]?.trim() : null,
                lastItem2: customer.last_items ? customer.last_items.split(',')[1]?.trim() : null,
            });

            // Send
            const success = await sendWhatsAppMessage(sock, phone, messageText);

            if (success) {
                await logOutreach(phone, category, template.id, messageText);
                sent++;
            } else {
                // Retry once after 5 seconds
                await sleep(5000);
                const retrySuccess = await sendWhatsAppMessage(sock, phone, messageText);
                if (retrySuccess) {
                    await logOutreach(phone, category, template.id, messageText);
                    sent++;
                } else {
                    failed++;
                }
            }

        } catch (err) {
            logger.error(`Outreach error for ${phone}:`, err.message);
            failed++;
        }

        // Random delay between messages: 2–6 minutes
        if (i < batch.length - 1) {
            const delay = randomDelay(2 * 60 * 1000, 6 * 60 * 1000);
            logger.debug(`Next message in ${Math.round(delay / 1000)}s...`);
            await sleep(delay);
        }
    }

    logger.info(`Outreach batch complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
}

/**
 * Get outreach stats for admin dashboard
 */
async function getOutreachStats() {
    const supabase = getSupabase();
    const weekNum = getWeekNumber();

    const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('opted_out', false);

    const { data: weekData } = await supabase
        .from('outreach_log')
        .select('phone, replied')
        .eq('week_number', weekNum);

    const messagedThisWeek = new Set((weekData || []).map(r => r.phone)).size;
    const repliedThisWeek = (weekData || []).filter(r => r.replied).length;

    return {
        totalCustomers: totalCustomers || 0,
        messagedThisWeek,
        remaining: (totalCustomers || 0) - messagedThisWeek,
        repliedThisWeek,
        replyRate: messagedThisWeek > 0 ? ((repliedThisWeek / messagedThisWeek) * 100).toFixed(1) + '%' : '0%',
        weekNumber: weekNum,
    };
}

module.exports = {
    getWeekNumber,
    getMessagedThisWeek,
    getMessagedYesterday,
    getLastCategory,
    markReplied,
    sendBatch,
    sendWhatsAppMessage,
    logOutreach,
    isWithinSendingHours,
    getOutreachStats,
};
