import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { correctLedgerSchema } from "@/lib/validators/ledger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = correctLedgerSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("UNAUTHENTICATED", "Sesi login tidak ditemukan", 401);

  const { error } = await supabase.rpc("fn_correct_ledger_entry", {
    p_ledger_entry_id: id,
    p_qty_delta: parsed.data.qty_delta,
    p_note: parsed.data.note,
    p_created_by: userData.user.id,
  });

  if (error) {
    if (error.message.includes("Stok tidak cukup")) {
      return fail("INSUFFICIENT_STOCK", error.message, 409);
    }
    if (error.message.includes("tidak bisa dikoreksi")) {
      return fail("NOT_CORRECTABLE", error.message, 409);
    }
    return handleError(error);
  }

  return ok({ ledger_entry_id: id, qty_delta: parsed.data.qty_delta });
}
