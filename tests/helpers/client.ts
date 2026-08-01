import { createClient } from "@supabase/supabase-js";
import ws from "ws";

// Test HARUS jalan ke project Supabase test terpisah, gak pernah ke
// production -- jangan sekali-kali baca dari .env.local di sini.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY gak ke-load dari .env.test"
  );
}

const wsTransport = ws as unknown as typeof WebSocket;

export async function getTestClient() {
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;

  // Service role dipakai SEKALI di sini cuma buat mastiin user test ada &
  // ke-confirm (bypass validasi email/verifikasi) -- semua RPC/query di
  // test sendiri tetap lewat client anon+signed-in biasa, sama kayak app.
  const admin = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: wsTransport },
  });

  const { data: existing, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;

  const found = existing.users.find((u) => u.email === email);
  if (!found) {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Test Runner" },
    });
    if (createError) throw createError;
  }

  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    realtime: { transport: wsTransport },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  return { supabase, userId: data.user!.id };
}
