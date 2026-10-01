import { createClient } from '@supabase/supabase-js'

// Reads only. All writes go through Postgres RPC functions (supabase.rpc).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
