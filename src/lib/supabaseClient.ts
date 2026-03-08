import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
  console.log('VITE_SUPABASE_URL:', supabaseUrl);
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'SET' : 'MISSING');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'flashmind-auth-token',
    flowType: 'pkce'
  },
  global: {
    headers: {
      'x-application-name': 'flashmind'
    }
  }
});

// Debug helper to check current session
export async function debugSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('🔍 Debug Session Check:');
  console.log('  Session exists:', !!session);
  console.log('  User ID:', session?.user?.id);
  console.log('  Access token:', session?.access_token ? 'Present' : 'Missing');
  console.log('  Error:', error);
  return session;
}
