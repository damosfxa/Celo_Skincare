import { beforeAll, describe, expect, it } from "vitest";
import { getTestClient } from "./helpers/client";
import { createTestProduct } from "./helpers/fixtures";
import { resolveItemsForProduct } from "../src/lib/services/orders";

describe("Bundle: resolve komponen & versioning resep", () => {
  let ctx: Awaited<ReturnType<typeof getTestClient>>;

  beforeAll(async () => {
    ctx = await getTestClient();
  });

  it("Bundle dipecah ke komponen sesuai resep aktif, qty dikali qty_per_bundle", async () => {
    const { supabase } = ctx;
    const bundle = await createTestProduct(supabase, { is_bundle: true });
    const compA = await createTestProduct(supabase);
    const compB = await createTestProduct(supabase);

    const { error: saveError } = await supabase.rpc("fn_save_bundle_recipe", {
      p_bundle_id: bundle.id,
      p_components: [
        { component_product_id: compA.id, qty_per_bundle: 2 },
        { component_product_id: compB.id, qty_per_bundle: 3 },
      ],
    });
    expect(saveError).toBeNull();

    const items = await resolveItemsForProduct(supabase, bundle.id, 4, true);
    const byProduct = new Map(items.map((i) => [i.product_id, i.qty]));
    expect(byProduct.get(compA.id)).toBe(8); // 2 x 4
    expect(byProduct.get(compB.id)).toBe(12); // 3 x 4
  });

  it("Edit resep: versi lama ditandai non-aktif (bukan dihapus), resolve cuma baca versi aktif", async () => {
    const { supabase } = ctx;
    const bundle = await createTestProduct(supabase, { is_bundle: true });
    const compA = await createTestProduct(supabase);
    const compC = await createTestProduct(supabase);

    await supabase.rpc("fn_save_bundle_recipe", {
      p_bundle_id: bundle.id,
      p_components: [{ component_product_id: compA.id, qty_per_bundle: 1 }],
    });

    // Resep diedit -- komponen A qty naik jadi 5, komponen C ditambah.
    await supabase.rpc("fn_save_bundle_recipe", {
      p_bundle_id: bundle.id,
      p_components: [
        { component_product_id: compA.id, qty_per_bundle: 5 },
        { component_product_id: compC.id, qty_per_bundle: 2 },
      ],
    });

    // resolve harus baca versi TERBARU aja -- kalau versi lama ikut kebaca,
    // qty A bakal ke-jumlah 1+5=6 (salah), bukan cuma 5.
    const items = await resolveItemsForProduct(supabase, bundle.id, 1, true);
    const byProduct = new Map(items.map((i) => [i.product_id, i.qty]));
    expect(byProduct.get(compA.id)).toBe(5);
    expect(byProduct.get(compC.id)).toBe(2);
    expect(items).toHaveLength(2); // bukan 3 baris (gak ada duplikat dari versi lama)

    // Verifikasi langsung ke tabel: versi lama tetap ADA (bukan dihapus,
    // bisa diaudit), cuma is_active=false.
    const { data: allRows } = await supabase
      .from("bundle_recipes")
      .select("component_product_id, qty_per_bundle, version, is_active")
      .eq("bundle_product_id", bundle.id)
      .order("version", { ascending: true });

    const oldRow = allRows!.find((r) => r.version === 1);
    const newRows = allRows!.filter((r) => r.version === 2);
    expect(oldRow).toBeTruthy();
    expect(oldRow!.is_active).toBe(false);
    expect(newRows).toHaveLength(2);
    expect(newRows.every((r) => r.is_active === true)).toBe(true);
  });

  it("Produk biasa (bukan bundle): resolve balikin dirinya sendiri apa adanya", async () => {
    const { supabase } = ctx;
    const product = await createTestProduct(supabase, { is_bundle: false });

    const items = await resolveItemsForProduct(supabase, product.id, 7, false);
    expect(items).toEqual([{ product_id: product.id, qty: 7 }]);
  });
});
