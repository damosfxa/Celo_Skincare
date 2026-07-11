import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const condition = searchParams.get("condition");
  const channel = searchParams.get("channel");

  const supabase = await createClient();
  let query = supabase
    .from("returns")
    .select(
      "id, order_id, order_item_id, qty, condition, photo_url, claim_deadline, inspected_by, inspected_at, created_at, orders(channel)"
    )
    .order("created_at", { ascending: false });

  if (condition) query = query.eq("condition", condition);

  const { data, error } = await query;
  if (error) return handleError(error);

  // Ratain channel ke top-level, jangan nested -- lebih gampang dikonsumsi
  // langsung sebagai return.channel.
  const flattened = (data ?? []).map((r: any) => {
    const { orders, ...rest } = r;
    return { ...rest, channel: orders?.channel ?? null };
  });

  const filtered = channel
    ? flattened.filter((r: any) => r.channel === channel)
    : flattened;

  return ok(filtered);
}