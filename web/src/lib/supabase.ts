import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Reads only. All writes go through Postgres RPC functions (src/lib/api.ts).
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
