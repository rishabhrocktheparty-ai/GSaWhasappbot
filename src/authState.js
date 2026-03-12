// src/whatsapp/authState.js

const { createClient } = require('@supabase/supabase-js');
const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const logger = require('../utils/logger');

const SESSION_NAME = 'grih_sansar_auth';

function getSupabase() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

async function useSupabaseAuthState() {
    const supabase = getSupabase();

    const writeData = async (data, id) => {
        try {
            const str = JSON.stringify(data, BufferJSON.replacer);
            await supabase.from('baileys_session').upsert({ 
                id: `${SESSION_NAME}-${id}`, 
                data: str 
            });
        } catch (err) {
            logger.error(`Failed to write session data for ${id}:`, err.message);
        }
    };

    const readData = async (id) => {
        try {
            const { data, error } = await supabase
                .from('baileys_session')
                .select('data')
                .eq('id', `${SESSION_NAME}-${id}`)
                .single();
            if (error || !data) return null;
            return JSON.parse(data.data, BufferJSON.reviver);
        } catch (err) {
            logger.error(`Failed to read session data for ${id}:`, err.message);
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            await supabase
                .from('baileys_session')
                .delete()
                .eq('id', `${SESSION_NAME}-${id}`);
        } catch (err) {
            logger.error(`Failed to remove session data for ${id}:`, err.message);
        }
    };

    const creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: () => writeData(creds, 'creds'),
        clearSession: async () => {
            logger.warn('Clearing all session data from Supabase...');
            await supabase
                .from('baileys_session')
                .delete()
                .like('id', `${SESSION_NAME}-%`);
        },
    };
}

module.exports = { useSupabaseAuthState };

