// src/outreach/scheduler.js

// ============================================================
// Daily Outreach Scheduler
// Runs once per day, picks today's batch, triggers staggered sending
// Guarantees 100% weekly coverage
// ============================================================

const { getActiveCustomers } = require('./snapbizz');
const { pickTemplate, personaliseTemplate } = require('./templates');
const { getMessagedThisWeek, getMessagedYesterday, sendBatch, isWithinSendingHours, markReplied: markRepliedInLog } = require('./sender');
const { resetNoReply, incrementNoReply } = require('./snapbizz');
const logger = require('../utils/logger');

let outreachSocket = null;
let isRunning = false;
let dailyTimer = null;

/**
 * Calculate today's batch size
 * Ensures 100% weekly coverage by adjusting daily target based on remaining customers
 */
function calculateDailyTarget(totalRemaining, dayOfWeek) {
    // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
    // We treat Monday as start of week
    const daysMapping = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1, 0: 1 }; // days remaining including today
    const daysLeft = daysMapping[dayOfWeek] || 1;

    let target = Math.ceil(totalRemaining / daysLeft);

    // Clamp to 100–200 range
    const minDaily = parseInt(process.env.OUTREACH_MIN_DAILY) || 100;
    const maxDaily = parseInt(process.env.OUTREACH_MAX_DAILY) || 200;

    target = Math.max(minDaily, Math.min(maxDaily, target));

    // If fewer customers remaining than min, send to all
    if (totalRemaining < target) target = totalRemaining;

    return target;
}

/**
 * Shuffle array randomly (Fisher-Yates)
 */
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Run daily outreach — the main function
 */
async function runDailyOutreach() {
    if (isRunning) {
        logger.warn('Outreach already running — skipping duplicate trigger');
        return { status: 'already_running' };
    }

    if (!outreachSocket) {
        logger.error('No WhatsApp socket available — outreach cannot run');
        return { status: 'no_socket' };
    }

    if (!isWithinSendingHours()) {
        logger.info('Outside sending hours (9 AM – 8 PM IST) — will retry later');
        return { status: 'outside_hours' };
    }

    isRunning = true;
    logger.info('═══ DAILY OUTREACH STARTED ═══');

    try {
        // Step 1: Get all active customers
        const allCustomers = await getActiveCustomers();
        if (allCustomers.length === 0) {
            logger.warn('No active customers found — import customers first');
            return { status: 'no_customers' };
        }
        logger.info(`Active customers: ${allCustomers.length}`);

        // Step 2: Get who's already been messaged this week
        const messagedThisWeek = await getMessagedThisWeek();
        logger.info(`Already messaged this week: ${messagedThisWeek.size}`);

        // Step 3: Get who was messaged yesterday (no consecutive days)
        const messagedYesterday = await getMessagedYesterday();
        logger.info(`Messaged yesterday (excluded): ${messagedYesterday.size}`);

        // Step 4: Build available pool
        const availablePool = allCustomers.filter(c =>
            !messagedThisWeek.has(c.phone) && !messagedYesterday.has(c.phone)
        );
        logger.info(`Available pool today: ${availablePool.length}`);

        if (availablePool.length === 0) {
            logger.info('All customers covered this week! Nothing to send.');
            return { status: 'all_covered', sent: 0 };
        }

        // Step 5: Calculate how many to send today
        const dayOfWeek = new Date().getDay();
        const dailyTarget = calculateDailyTarget(availablePool.length, dayOfWeek);
        logger.info(`Daily target: ${dailyTarget} messages`);

        // Step 6: Randomly pick today's batch
        const shuffled = shuffle(availablePool);
        const todaysBatch = shuffled.slice(0, dailyTarget);
        logger.info(`Today's batch: ${todaysBatch.length} customers selected`);

        // Step 7: Send with staggered delays
        const result = await sendBatch(
            outreachSocket,
            todaysBatch,
            pickTemplate,
            personaliseTemplate
        );

        logger.info(`═══ DAILY OUTREACH COMPLETE: ${result.sent} sent, ${result.failed} failed ═══`);
        return { status: 'complete', ...result, batchSize: todaysBatch.length };

    } catch (error) {
        logger.error('Daily outreach failed:', error.message);
        return { status: 'error', error: error.message };

    } finally {
        isRunning = false;
    }
}

/**
 * Schedule daily outreach
 * Runs at 9:15 AM IST every day
 */
function scheduleDailyRun() {
    // Calculate ms until next 9:15 AM IST
    function msUntilNextRun() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);

        const target = new Date(istNow);
        target.setUTCHours(3, 45, 0, 0); // 9:15 AM IST = 3:45 AM UTC

        if (istNow.getUTCHours() > 3 || (istNow.getUTCHours() === 3 && istNow.getUTCMinutes() >= 45)) {
            target.setDate(target.getDate() + 1); // Tomorrow
        }

        return target.getTime() - now.getTime();
    }

    function scheduleNext() {
        const ms = msUntilNextRun();
        const hours = Math.round(ms / 3600000 * 10) / 10;
        logger.info(`Next outreach scheduled in ${hours} hours`);

        dailyTimer = setTimeout(async () => {
            await runDailyOutreach();
            scheduleNext(); // Schedule next day
        }, ms);
    }

    scheduleNext();
}

/**
 * Start the outreach system
 * Called when WhatsApp connection is established
 */
function startDailyOutreach(sock) {
    if (process.env.OUTREACH_ENABLED !== 'true') {
        logger.info('Outreach system is DISABLED. Set OUTREACH_ENABLED=true to activate.');
        return;
    }

    outreachSocket = sock;
    logger.info('═══ OUTREACH SYSTEM INITIALISED ═══');

    // Schedule daily runs at 9:15 AM IST
    scheduleDailyRun();

    // If we're currently within sending hours, run immediately (catch-up)
    if (isWithinSendingHours()) {
        logger.info('Within sending hours — running catch-up outreach in 2 minutes...');
        setTimeout(() => runDailyOutreach(), 2 * 60 * 1000);
    }
}

/**
 * Stop the outreach system
 */
function stopOutreach() {
    if (dailyTimer) {
        clearTimeout(dailyTimer);
        dailyTimer = null;
    }
    outreachSocket = null;
    isRunning = false;
    logger.info('Outreach system stopped.');
}

/**
 * Handle outreach reply — called when a customer replies after receiving outreach
 */
async function markOutreachReplied(userId) {
    const phone = userId.split('@')[0];
    try {
        await markRepliedInLog(phone);
        await resetNoReply(phone);
        logger.debug(`Outreach reply tracked for ${phone}`);
    } catch (err) {
        logger.error(`Failed to track outreach reply for ${phone}:`, err.message);
    }
}

module.exports = {
    startDailyOutreach,
    stopOutreach,
    runDailyOutreach,
    markOutreachReplied,
};
