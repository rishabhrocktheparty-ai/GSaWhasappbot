// src/outreach/snapbizz.js

// ============================================================
// Snap Bizz Customer Data Import
// Supports: CSV upload, Excel upload, or manual JSON
// Stores customer data in Supabase for outreach scheduling
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

function getSupabase() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

// ── Flexible column mapping ──
// Snap Bizz exports can have different column headers
const COLUMN_ALIASES = {
    name: ['name', 'customer name', 'customer_name', 'cust_name', 'full name', 'fullname'],
    phone: ['phone', 'mobile', 'whatsapp', 'whatsapp number', 'phone number', 'mobile number', 'contact', 'mob'],
    lastPurchaseDate: ['last visit', 'last purchase', 'last_purchase_date', 'last purchase date', 'last_visit', 'date'],
    lastItems: ['items', 'products', 'last items', 'last_items', 'last products', 'purchased items'],
    totalSpent: ['total spent', 'total_spent', 'lifetime value', 'total', 'amount', 'total amount'],
    visitCount: ['visit count', 'visits', 'visit_count', 'total visits', 'no of visits'],
};

/**
 * Map CSV header to our field name
 */
function mapColumn(header) {
    const clean = header.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.includes(clean)) return field;
    }
    return null; // Unknown column, skip
}

/**
 * Clean and validate phone number
 * Handles: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 * Returns: 91XXXXXXXXXX (without +)
 */
function cleanPhone(raw) {
    if (!raw) return null;
    let phone = String(raw).replace(/[\s\-\(\)\+\.]/g, '');

    // Remove leading 0
    if (phone.startsWith('0') && phone.length === 11) {
        phone = '91' + phone.slice(1);
    }
    // Add 91 if just 10 digits
    if (phone.length === 10 && !phone.startsWith('91')) {
        phone = '91' + phone;
    }
    // Remove leading + if present
    if (phone.startsWith('+')) phone = phone.slice(1);

    // Validate: must be 12 digits starting with 91
    if (phone.length === 12 && phone.startsWith('91') && /^\d+$/.test(phone)) {
        return phone;
    }

    return null; // Invalid
}

/**
 * Parse CSV text into customer records
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { customers: [], errors: ['CSV has no data rows'] };

    // Parse header
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const columnMap = {};
    headers.forEach((h, i) => {
        const field = mapColumn(h);
        if (field) columnMap[i] = field;
    });

    // Check we have at least phone
    const hasPhone = Object.values(columnMap).includes('phone');
    if (!hasPhone) {
        return { customers: [], errors: ['No phone/mobile column found. Expected: phone, mobile, whatsapp number, etc.'] };
    }

    const customers = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parsing (handles basic quoting)
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const record = {};

        values.forEach((val, idx) => {
            const field = columnMap[idx];
            if (field) {
                record[field] = val.replace(/^"|"$/g, '').trim();
            }
        });

        // Clean phone
        const phone = cleanPhone(record.phone);
        if (!phone) {
            errors.push(`Row ${i + 1}: Invalid phone "${record.phone}"`);
            continue;
        }

        customers.push({
            phone,
            name: record.name || 'Customer',
            last_purchase_date: record.lastPurchaseDate ? new Date(record.lastPurchaseDate).toISOString() : null,
            last_items: record.lastItems || null,
            total_spent: parseFloat(record.totalSpent) || 0,
            visit_count: parseInt(record.visitCount) || 0,
        });
    }

    return { customers, errors };
}

/**
 * Import customers into Supabase
 * Upserts — updates existing, inserts new
 */
async function importCustomers(customers) {
    const supabase = getSupabase();
    let imported = 0;
    let failed = 0;
    const errors = [];

    // Batch upsert in chunks of 50
    for (let i = 0; i < customers.length; i += 50) {
        const batch = customers.slice(i, i + 50).map(c => ({
            ...c,
            opted_out: false,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('customers')
            .upsert(batch, { onConflict: 'phone' });

        if (error) {
            failed += batch.length;
            errors.push(`Batch ${Math.floor(i / 50) + 1}: ${error.message}`);
            logger.error('Customer import batch failed:', error.message);
        } else {
            imported += batch.length;
        }
    }

    logger.info(`Customer import complete: ${imported} imported, ${failed} failed`);
    return { imported, failed, errors };
}

/**
 * Get all active customers (not opted out, not paused)
 */
async function getActiveCustomers() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('opted_out', false)
        .lt('consecutive_no_reply', 4); // Pause after 4 weeks of no reply

    if (error) {
        logger.error('Failed to fetch active customers:', error.message);
        return [];
    }
    return data || [];
}

/**
 * Get customer count
 */
async function getCustomerCount() {
    const supabase = getSupabase();
    const { count, error } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('opted_out', false);

    return error ? 0 : count;
}

/**
 * Mark a customer as opted out
 */
async function optOutCustomer(phone) {
    const supabase = getSupabase();
    await supabase
        .from('customers')
        .update({ opted_out: true, updated_at: new Date().toISOString() })
        .eq('phone', phone);
    logger.info(`Customer opted out: ${phone}`);
}

/**
 * Increment no-reply counter for a customer
 */
async function incrementNoReply(phone) {
    const supabase = getSupabase();
    const { data } = await supabase
        .from('customers')
        .select('consecutive_no_reply')
        .eq('phone', phone)
        .single();

    const current = data?.consecutive_no_reply || 0;
    await supabase
        .from('customers')
        .update({ consecutive_no_reply: current + 1, updated_at: new Date().toISOString() })
        .eq('phone', phone);
}

/**
 * Reset no-reply counter (customer replied)
 */
async function resetNoReply(phone) {
    const supabase = getSupabase();
    await supabase
        .from('customers')
        .update({ consecutive_no_reply: 0, updated_at: new Date().toISOString() })
        .eq('phone', phone);
}

module.exports = {
    parseCSV,
    importCustomers,
    getActiveCustomers,
    getCustomerCount,
    optOutCustomer,
    incrementNoReply,
    resetNoReply,
    cleanPhone,
};
