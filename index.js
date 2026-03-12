// ============================================================
// REE — WhatsApp Shopping Companion
// GRIH SANSAR DEPARTMENTAL STORE
// "Think Before You Blink."
// ============================================================

require('dotenv').config();
const express = require('express');
const pino = require('pino');
const { connectToWhatsApp } = require('./src/whatsapp');
const { validateEnv } = require('./src/utils/env');
const logger = require('./src/utils/logger');
const { parseCSV, importCustomers, getCustomerCount } = require('./src/outreach/snapbizz');
const { runDailyOutreach } = require('./src/outreach/scheduler');
const { getOutreachStats } = require('./src/outreach/sender');

// ── Validate environment before anything else ──
validateEnv();

// ── Express server (health check + QR display) ──
const app = express();
const PORT = process.env.PORT || 10000;

// Shared state for QR and bot status
const botState = {
    qr: '',
    status: 'Starting...',
    connectedAt: null,
    messagesHandled: 0,
};

// Export so whatsapp module can update it
module.exports = { botState };

// Health check / QR display
app.get('/', (req, res) => {
    if (botState.status === 'Ready') {
        res.send(`
            <div style="text-align:center; font-family:Arial; margin-top:50px;">
                <h1 style="color:#1B4332;">✅ GRIH SANSAR Bot — ONLINE</h1>
                <p style="color:#2D6A4F;">REE is ready and listening.</p>
                <p style="color:#6C757D; font-size:14px;">Connected since: ${botState.connectedAt || 'N/A'}</p>
                <p style="color:#6C757D; font-size:14px;">Messages handled: ${botState.messagesHandled}</p>
                <br><p style="color:#999; font-style:italic;">"Think Before You Blink."</p>
            </div>
        `);
    } else if (botState.qr) {
        res.send(`
            <div style="text-align:center; font-family:Arial; margin-top:50px;">
                <h2 style="color:#1B4332;">📱 Scan QR to Connect REE</h2>
                <p style="color:#6C757D;">Open WhatsApp → Linked Devices → Scan this code</p>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(botState.qr)}" 
                     style="border: 5px solid #25d366; border-radius: 10px; margin-top:20px;" />
                <br><br><p style="color:#999; font-style:italic;">"Think Before You Blink."</p>
            </div>
        `);
    } else {
        res.send(`
            <div style="text-align:center; font-family:Arial; margin-top:50px;">
                <h2 style="color:#F4A261;">⏳ ${botState.status}</h2>
                <p style="color:#6C757D;">Please wait...</p>
            </div>
        `);
    }
});

// Health endpoint for monitoring
app.get('/health', (req, res) => {
    res.json({ 
        status: botState.status, 
        uptime: process.uptime(),
        messages: botState.messagesHandled 
    });
});

// ══════════════════════════════════════
// ADMIN ENDPOINTS (protected by ADMIN_TOKEN)
// ══════════════════════════════════════

// Middleware: simple token auth
function adminAuth(req, res, next) {
    const token = process.env.ADMIN_TOKEN;
    if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN not set on server' });

    const provided = req.headers['x-admin-token'] || req.query.token;
    if (provided !== token) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// Parse JSON and text bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: 'text/csv', limit: '10mb' }));

// POST /admin/upload-customers — Upload Snap Bizz CSV data
// Send CSV text in request body with Content-Type: text/csv
// Or send JSON array with Content-Type: application/json
app.post('/admin/upload-customers', adminAuth, async (req, res) => {
    try {
        let customers, parseErrors;

        if (typeof req.body === 'string') {
            // CSV text
            const result = parseCSV(req.body);
            customers = result.customers;
            parseErrors = result.errors;
        } else if (Array.isArray(req.body)) {
            // Direct JSON array
            customers = req.body;
            parseErrors = [];
        } else {
            return res.status(400).json({ error: 'Send CSV text (Content-Type: text/csv) or JSON array (Content-Type: application/json)' });
        }

        if (customers.length === 0) {
            return res.status(400).json({ error: 'No valid customers found', parseErrors });
        }

        const result = await importCustomers(customers);
        res.json({
            message: `Import complete: ${result.imported} customers imported`,
            ...result,
            parseErrors,
        });
    } catch (err) {
        logger.error('Customer upload failed:', err.message);
        res.status(500).json({ error: 'Import failed: ' + err.message });
    }
});

// GET /admin/outreach-stats — View outreach statistics
app.get('/admin/outreach-stats', adminAuth, async (req, res) => {
    try {
        const stats = await getOutreachStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /admin/trigger-outreach — Manually trigger today's batch
app.post('/admin/trigger-outreach', adminAuth, async (req, res) => {
    try {
        res.json({ message: 'Outreach triggered — running in background' });
        runDailyOutreach(); // Don't await — runs in background
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /admin/customer-count — Quick count check
app.get('/admin/customer-count', adminAuth, async (req, res) => {
    try {
        const count = await getCustomerCount();
        res.json({ activeCustomers: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

// ── Start WhatsApp connection ──
connectToWhatsApp();

// ── Self-ping to keep Render alive ──
const RENDER_URL = process.env.RENDER_EXTERNAL_HOSTNAME;
if (RENDER_URL) {
    setInterval(() => {
        fetch(`https://${RENDER_URL}/health`).catch(() => {});
    }, 10 * 60 * 1000); // Every 10 minutes
}

// ── Graceful shutdown ──
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection:', err.message);
});
# Enable debug logging
DEBUG=false

# ── Outreach System ──
# Enable/disable proactive messaging (set to true when ready)
OUTREACH_ENABLED=false

# Admin token for /admin/* endpoints (set a random secure string)
ADMIN_TOKEN=your-secret-admin-token-here

# Daily message limits
OUTREACH_MIN_DAILY=100
OUTREACH_MAX_DAILY=200

# Sending hours in IST (24-hour format)
OUTREACH_START_HOUR=9
OUTREACH_END_HOUR=20
