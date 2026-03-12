// src/utils/env.js
const logger = require('./logger');

const REQUIRED_VARS = [
    'OPENROUTER_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_KEY',
];

const OPTIONAL_VARS = [
    'OWNER_GROUP_JID',
    'RENDER_EXTERNAL_HOSTNAME',
    'DEBUG',
];

function validateEnv() {
    const missing = REQUIRED_VARS.filter(v => !process.env[v]);

    if (missing.length > 0) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        logger.error('Set these in your Render dashboard under Environment Variables.');
        process.exit(1);
    }

    // Warn about optional vars
    OPTIONAL_VARS.forEach(v => {
        if (!process.env[v]) {
            logger.warn(`Optional env var ${v} not set.`);
        }
    });

    if (!process.env.OWNER_GROUP_JID) {
        logger.warn('OWNER_GROUP_JID not set — order notifications will NOT be sent to admin group.');
    }

    logger.info('Environment validated successfully.');
}

module.exports = { validateEnv };

