import "server-only";
import { createClient } from "@supabase/supabase-js";

// Klien service role: hanya di server. Semua akses data (PWA & BO) lewat sini.
export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "missing",
  { auth: { persistSession: false, autoRefreshToken: false } }
);
