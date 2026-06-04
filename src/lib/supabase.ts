import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && key);

export const STORAGE_BUCKET = 'study-files';

let _client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  _client = createClient(url!, key!);
  // eslint-disable-next-line no-console
  console.info('%c[StudyTrainer] Supabase Storage ON — files are shared via Supabase.', 'color:#3ECF8E;font-weight:600');
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[StudyTrainer] Supabase Storage OFF — file uploads will be local only. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud file sharing.',
  );
}

export const supabase = _client;
