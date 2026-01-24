import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton instance management
let supabaseInstance: SupabaseClient | null = null;
let currentConfig: { url: string; key: string } | null = null;

export const getSupabase = (url?: string, key?: string): SupabaseClient | null => {
    // If specific credentials passed, create/overwrite
    if (url && key) {
        if (!supabaseInstance || currentConfig?.url !== url || currentConfig?.key !== key) {
            try {
                supabaseInstance = createClient(url, key);
                currentConfig = { url, key };
                // Persist for convenience in this session
                localStorage.setItem('dt_supabase_url', url);
                localStorage.setItem('dt_supabase_key', key);
            } catch (e) {
                console.error("Failed to init supabase", e);
                return null;
            }
        }
        return supabaseInstance;
    }

    // Check existing instance
    if (supabaseInstance) return supabaseInstance;

    // Check Env Vars (if available in build)
    const envUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const envKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (envUrl && envKey) {
        supabaseInstance = createClient(envUrl, envKey);
        return supabaseInstance;
    }

    // Check Local Storage (User previous session)
    const storedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('dt_supabase_url') : null;
    const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('dt_supabase_key') : null;

    if (storedUrl && storedKey) {
        try {
            supabaseInstance = createClient(storedUrl, storedKey);
            currentConfig = { url: storedUrl, key: storedKey };
            return supabaseInstance;
        } catch (e) {
             return null;
        }
    }

    return null;
};

export const clearSupabaseConfig = () => {
    supabaseInstance = null;
    currentConfig = null;
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('dt_supabase_url');
        localStorage.removeItem('dt_supabase_key');
    }
};

export const hasSupabaseConfig = (): boolean => {
    return !!(supabaseInstance || 
           (typeof localStorage !== 'undefined' && localStorage.getItem('dt_supabase_url')) || 
           process.env.SUPABASE_URL);
};