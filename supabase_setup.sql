-- ============================================================
-- GRIH SANSAR — REE Bot Database Setup
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. WhatsApp session storage (already exists if bot was running)
CREATE TABLE IF NOT EXISTS baileys_session (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

-- 2. Customer directory (imported from Snap Bizz)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT 'Customer',
    last_purchase_date TIMESTAMP,
    last_items TEXT,
    total_spent NUMERIC DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    opted_out BOOLEAN DEFAULT FALSE,
    consecutive_no_reply INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Outreach message log
CREATE TABLE IF NOT EXISTS outreach_log (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    template_category TEXT NOT NULL,
    template_id TEXT NOT NULL,
    message_text TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    week_number INTEGER NOT NULL,
    replied BOOLEAN DEFAULT FALSE
);

-- Index for fast weekly lookups
CREATE INDEX IF NOT EXISTS idx_outreach_phone_week 
    ON outreach_log(phone, week_number);

-- Index for fast "messaged yesterday" lookups
CREATE INDEX IF NOT EXISTS idx_outreach_sent_at 
    ON outreach_log(sent_at);

-- Index for customer phone lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone 
    ON customers(phone);

-- ============================================================
-- Done! You now have 3 tables:
-- 1. baileys_session  → WhatsApp auth persistence
-- 2. customers        → Customer directory from Snap Bizz
-- 3. outreach_log     → Tracks every outreach message sent
-- ============================================================
