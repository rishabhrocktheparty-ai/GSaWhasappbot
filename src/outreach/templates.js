// src/outreach/templates.js

// ============================================================
// REE — Outreach Message Templates
// GRIH SANSAR DEPARTMENTAL STORE
// Every message MUST end with: "Think Before You Blink."
// ============================================================

const TEMPLATES = {

    // ═══════════════════════════════════════
    // CATEGORY 1: WARM GREETINGS
    // ═══════════════════════════════════════
    greetings: [
        {
            id: 'greet_01',
            text: `Hi {name}! 😊 Just checking in from GRIH SANSAR. Need anything for the kitchen today? Just send your list and we'll have it at your door in 15–30 minutes. Happy to help anytime!\n\nThink Before You Blink.`,
        },
        {
            id: 'greet_02',
            text: `Good morning {name}! ☀️ Hope your day is off to a great start. If the pantry needs a top-up, I'm just a message away — 15–30 min delivery, always fresh.\n\nThink Before You Blink.`,
        },
        {
            id: 'greet_03',
            text: `Hey {name}! 😊 It's been a little while — just wanted you to know GRIH SANSAR is always here when you need us. Type your grocery list anytime and it'll be at your doorstep in 15–30 minutes.\n\nThink Before You Blink.`,
        },
        {
            id: 'greet_04',
            text: `Hi {name}! 🌟 Quick reminder — your neighbourhood store GRIH SANSAR is just a message away. Fresh groceries, great prices, 15–30 min delivery. No app needed, just WhatsApp!\n\nThink Before You Blink.`,
        },
        {
            id: 'greet_05',
            text: `Hello {name}! Hope the week is going well. If you need groceries, household items, or even just a quick snack ingredient — send me a list. I'll have it ready in 15–30 minutes! 😊\n\nThink Before You Blink.`,
        },
    ],

    // ═══════════════════════════════════════
    // CATEGORY 2: REORDER NUDGES
    // ═══════════════════════════════════════
    reorder: [
        {
            id: 'reorder_01',
            text: `Hi {name}! It's been a while since your last grocery run. Running low on essentials? Just say "Reorder" and I'll set up your usual basket — delivered in 15–30 minutes! 🛒\n\nThink Before You Blink.`,
        },
        {
            id: 'reorder_02',
            text: `Hey {name}! 😊 Your pantry might be getting light — last time you picked up some great staples from us. Shall I put together a similar basket? 15–30 min to your door as always.\n\nThink Before You Blink.`,
        },
        {
            id: 'reorder_03',
            text: `Hi {name}! About time for a restock? 🛒 I remember your last order — just say "Repeat" and I'll get it ready. Fresh and at your door in 15–30 minutes.\n\nThink Before You Blink.`,
        },
        {
            id: 'reorder_04',
            text: `Hello {name}! Quick thought — it's been a few weeks since your last visit to GRIH SANSAR. Need atta, dal, oil, or anything else? Just type your list and we'll deliver in 15–30 minutes! 😊\n\nThink Before You Blink.`,
        },
        {
            id: 'reorder_05',
            text: `Hi {name}! 🌿 Monthly groceries due? I can set up your usual basket in seconds. Just say the word — 15–30 min delivery, no rush, no fuss.\n\nThink Before You Blink.`,
        },
    ],

    // ═══════════════════════════════════════
    // CATEGORY 3: SEASONAL & FRESH ARRIVALS
    // ═══════════════════════════════════════
    seasonal: [
        {
            id: 'seasonal_01',
            text: `Hey {name}! 🥭 Fresh seasonal fruits just arrived at GRIH SANSAR — they're looking amazing! Want me to add some to a quick basket? 15–30 min to your door.\n\nThink Before You Blink.`,
        },
        {
            id: 'seasonal_02',
            text: `Hi {name}! 🌿 We just got a fresh batch of green vegetables — palak, methi, and more. Perfect for a healthy home-cooked meal. Need any? 15–30 min delivery!\n\nThink Before You Blink.`,
        },
        {
            id: 'seasonal_03',
            text: `Hello {name}! New arrivals at GRIH SANSAR this week — fresh dry fruits, premium ghee, and some great snack options. Want me to share what's new? 😊\n\nThink Before You Blink.`,
        },
        {
            id: 'seasonal_04',
            text: `Hi {name}! ☀️ Summer essentials are in — cold drinks, sharbat mixes, and fresh nimbu. Beat the heat with a quick order, delivered in 15–30 minutes!\n\nThink Before You Blink.`,
        },
        {
            id: 'seasonal_05',
            text: `Hey {name}! 🧊 Winters call for comfort food — we've got fresh paneer, ghee, and all the makings for gajar ka halwa. Want me to set up a basket? 15–30 min delivery.\n\nThink Before You Blink.`,
        },
    ],

    // ═══════════════════════════════════════
    // CATEGORY 4: RECIPE & COOKING NUDGES
    // ═══════════════════════════════════════
    recipe: [
        {
            id: 'recipe_01',
            text: `Hi {name}! 🍳 Quick idea — tonight's snack could be fresh Besan Chilla. Takes 5 minutes! Need besan, onions, or tomatoes? I'll have them at your door in 15–30 minutes.\n\nThink Before You Blink.`,
        },
        {
            id: 'recipe_02',
            text: `Hey {name}! Feeling hungry? Instead of ordering outside, try Masala Toast — just bread, tomato, butter, and chaat masala. Fresh and ready in 5 min! Need ingredients? 🛒\n\nThink Before You Blink.`,
        },
        {
            id: 'recipe_03',
            text: `Hi {name}! 😊 Weekend snack idea — Poha! Quick, healthy, and delicious. Need flattened rice, peanuts, or onions? Send me a list and I'll deliver in 15–30 minutes.\n\nThink Before You Blink.`,
        },
        {
            id: 'recipe_04',
            text: `Hello {name}! Kids hungry? Paneer Sandwich takes just 5 minutes — bread, paneer, capsicum, and chutney. Want me to send the ingredients? 15–30 min delivery! 🥪\n\nThink Before You Blink.`,
        },
        {
            id: 'recipe_05',
            text: `Hi {name}! 🍲 Quick dinner idea — Rava Upma. Healthy, filling, and done in 10 minutes. Need rava, curry leaves, or mustard seeds? Just type what you need!\n\nThink Before You Blink.`,
        },
        {
            id: 'recipe_06',
            text: `Hey {name}! Why order outside when you can make Vegetable Omelette in 5 minutes? Eggs, onion, tomato, capsicum — that's it! Need any of these? 15–30 min delivery 🍳\n\nThink Before You Blink.`,
        },
    ],

    // ═══════════════════════════════════════
    // CATEGORY 5: SAVINGS & VALUE
    // ═══════════════════════════════════════
    savings: [
        {
            id: 'savings_01',
            text: `Hi {name}! 💰 Did you know? Families shopping with GRIH SANSAR save ₹200–400 every month compared to quick-commerce apps — and still get 15–30 minute delivery. Smart shopping!\n\nThink Before You Blink.`,
        },
        {
            id: 'savings_02',
            text: `Hey {name}! Here's a thought — the same grocery basket that costs ₹1,500 on delivery apps costs about ₹1,200 at GRIH SANSAR. Same 15–30 min delivery, better prices. 🌟\n\nThink Before You Blink.`,
        },
        {
            id: 'savings_03',
            text: `Hi {name}! 😊 No surge pricing, no hidden delivery fees, no inflated MRP. Just honest neighbourhood prices with 15–30 min delivery. That's the GRIH SANSAR promise.\n\nThink Before You Blink.`,
        },
        {
            id: 'savings_04',
            text: `Hello {name}! Quick maths — shopping with GRIH SANSAR twice a month instead of delivery apps could save you ₹3,000–5,000 per year. Same convenience, better value! 💰\n\nThink Before You Blink.`,
        },
    ],

    // ═══════════════════════════════════════
    // CATEGORY 6: FESTIVAL & OCCASIONS
    // ═══════════════════════════════════════
    festival: [
        {
            id: 'festival_diwali',
            text: `Happy Diwali, {name}! 🪔✨ GRIH SANSAR has special festival essentials ready — dry fruits, ghee, sweets ingredients, and more. Want me to put together a Diwali combo? 15–30 min delivery!\n\nThink Before You Blink.`,
        },
        {
            id: 'festival_holi',
            text: `Happy Holi, {name}! 🌈 We've got thandai mix, gujiya ingredients, colours, and party snacks ready. Shall I set up a Holi basket for you? Delivered in 15–30 minutes!\n\nThink Before You Blink.`,
        },
        {
            id: 'festival_navratri',
            text: `Shubh Navratri, {name}! 🙏 Fasting essentials available — sabudana, kuttu atta, sendha namak, fruits, and more. Need a Navratri basket? 15–30 min delivery!\n\nThink Before You Blink.`,
        },
        {
            id: 'festival_rakhi',
            text: `Happy Raksha Bandhan, {name}! 🎀 Need sweets, dry fruits, or cooking ingredients for the celebration? I'll have everything at your door in 15–30 minutes! 😊\n\nThink Before You Blink.`,
        },
        {
            id: 'festival_eid',
            text: `Eid Mubarak, {name}! 🌙 Celebrating with family? We have everything you need — spices, dry fruits, paneer, and more. 15–30 min delivery as always!\n\nThink Before You Blink.`,
        },
        {
            id: 'festival_weekend',
            text: `Happy weekend, {name}! 😊 Planning a family meal? Send me your ingredient list and I'll have it at your door in 15–30 minutes. Enjoy cooking at home — it's always better fresh!\n\nThink Before You Blink.`,
        },
        {
            id: 'festival_newyear',
            text: `Happy New Year, {name}! 🎉 Starting the year fresh? Stock up on groceries and essentials — just send your list. 15–30 min delivery to kick off the year right!\n\nThink Before You Blink.`,
        },
    ],
};

// ── All categories in order of priority ──
const CATEGORIES = ['greetings', 'reorder', 'seasonal', 'recipe', 'savings', 'festival'];

/**
 * Pick a random template for a customer
 * Avoids repeating the same category or template used recently
 */
function pickTemplate(lastCategory, lastTemplateIds = []) {
    // Filter out the last used category to ensure variety
    let availableCategories = CATEGORIES.filter(c => c !== lastCategory);

    // If all filtered out (shouldn't happen), reset
    if (availableCategories.length === 0) availableCategories = CATEGORIES;

    // Pick random category
    const category = availableCategories[Math.floor(Math.random() * availableCategories.length)];
    const templates = TEMPLATES[category];

    // Filter out recently used template IDs
    let available = templates.filter(t => !lastTemplateIds.includes(t.id));
    if (available.length === 0) available = templates; // Reset if all used

    // Pick random template
    const template = available[Math.floor(Math.random() * available.length)];

    return { category, template };
}

/**
 * Personalise a template with customer data
 */
function personaliseTemplate(templateText, customerData) {
    let text = templateText;
    text = text.replace(/{name}/g, customerData.name || 'there');
    text = text.replace(/{lastItem1}/g, customerData.lastItem1 || 'your essentials');
    text = text.replace(/{lastItem2}/g, customerData.lastItem2 || 'pantry staples');
    text = text.replace(/{seasonalItem}/g, customerData.seasonalItem || 'seasonal produce');
    text = text.replace(/{festivalName}/g, customerData.festivalName || 'this special occasion');
    return text;
}

module.exports = { TEMPLATES, CATEGORIES, pickTemplate, personaliseTemplate };
