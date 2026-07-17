import { createClient } from "@/lib/supabase/server";
import { ok, fail, handleError } from "@/lib/api-response";
import { inspectReturnSchema } from "@/lib/validators/returns";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = inspectReturnSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0].message, 422);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("UNAUTHENTICATED", "Sesi login tidak ditemukan", 401);

  const { error } = await supabase.rpc("fn_inspect_return", {
    p_return_id: id,
    p_condition: parsed.data.condition,
    p_inspected_by: userData.user.id,
    p_photo_url: parsed.data.photo_url ?? null,
    p_expiry_date: parsed.data.expiry_date ?? null,
  });
  if (error) return handleError(error);

  return ok({
    return_id: id,
    condition: parsed.data.condition,
    ledger_written: parsed.data.condition === "SELLABLE",
  });
}