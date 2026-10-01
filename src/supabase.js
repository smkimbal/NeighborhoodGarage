import { createClient } from '@supabase/supabase-js';
const cfg = window.NG_CONFIG || {};
if(!cfg.supabaseUrl || !cfg.supabaseKey) throw new Error('Supabase configuration is missing.');
export const supabase = createClient(cfg.supabaseUrl,cfg.supabaseKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
  realtime:{params:{eventsPerSecond:10}}
});
