import { createClient } from '@supabase/supabase-js';

var url = import.meta.env.VITE_SUPABASE_URL;
var anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Auth and DB features will not work.');
}

export var supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder'
);

export var supabaseWindpal = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  { db: { schema: 'windpal' } }
);
