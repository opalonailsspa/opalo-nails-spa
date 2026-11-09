import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase para el Frontend de Ópalo Nails Spa.
// Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tus variables de entorno (Vercel / .env).
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
