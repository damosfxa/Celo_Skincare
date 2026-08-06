-- ============================================================
-- diagnostic-security-audit-2026-08-06.sql
--
-- READ-ONLY. Tidak mengubah apa pun. Aman dijalankan kapan saja.
--
-- Tujuan: memeriksa seluruh postur keamanan database ASLI langsung
-- dari kondisi live (bukan asumsi file migration). Menutup celah
-- "drift": migration bilang aman, kondisi live bisa beda.
--
-- Digabung jadi SATU query (UNION ALL) supaya sekali Run semua hasil
-- muncul di satu tabel. Cara baca: lihat kolom "status".
--   - 'AMAN' / 'info'  -> tidak perlu tindakan.
--   - 'PERIKSA'        -> perlu dilihat, mungkin celah.
--   - 'MASALAH'        -> celah nyata, laporkan ke Claude.
--
-- Baris paling atas = yang paling perlu perhatian (diurutkan).
-- ============================================================

WITH hasil AS (

  -- 1. RLS aktif di semua tabel public?
  SELECT
    1 AS urut, '1. RLS per tabel' AS pemeriksaan,
    c.relname AS item,
    'tabel' AS detail,
    CASE WHEN c.relrowsecurity THEN 'AMAN' ELSE 'MASALAH (RLS mati)' END AS status
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'

  UNION ALL
  -- 2. Role tiap policy (harus authenticated saja)
  SELECT
    2, '2. Role policy',
    p.tablename || ' / ' || p.policyname,
    p.cmd || ' -> ' || array_to_string(p.roles::text[], ', '),
    CASE
      WHEN 'authenticated' = ANY(p.roles::text[])
           AND NOT ('anon' = ANY(p.roles::text[]))
           AND NOT ('public' = ANY(p.roles::text[])) THEN 'AMAN'
      ELSE 'PERIKSA (bukan authenticated saja)'
    END
  FROM pg_policies p
  WHERE p.schemaname = 'public'

  UNION ALL
  -- 3. Tabel RLS aktif tapi tanpa policy (deny-all, biasanya tak disengaja)
  SELECT
    3, '3. RLS tanpa policy',
    c.relname, 'tabel RLS aktif, 0 policy',
    'PERIKSA (semua akses ditolak)'
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p2 WHERE p2.schemaname = 'public' AND p2.tablename = c.relname
    )

  UNION ALL
  -- 4. Fungsi tanpa SET search_path
  SELECT
    4, '4. Fungsi tanpa search_path',
    p.proname,
    CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'fungsi biasa' END,
    CASE WHEN p.prosecdef THEN 'MASALAH (SD wajib search_path)'
         ELSE 'PERIKSA (warning advisor, risiko rendah)' END
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    )

  UNION ALL
  -- 5. View tanpa security_invoker (bisa bypass RLS tabel dasar)
  SELECT
    5, '5. View tanpa security_invoker',
    c.relname, 'view',
    'MASALAH (bisa bypass RLS tabel dasar)'
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v'
    AND NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(c.reloptions, ARRAY[]::text[])) opt
      WHERE opt IN ('security_invoker=true', 'security_invoker=on')
    )

  UNION ALL
  -- 6a. Bucket storage: publik atau privat + jumlah policy storage.objects
  SELECT
    6, '6a. Bucket storage',
    b.name,
    CASE WHEN b.public THEN 'PUBLIK' ELSE 'privat' END
      || ' | total policy storage.objects: '
      || (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'),
    CASE WHEN b.public
           AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects')
         THEN 'PERIKSA (publik + 0 policy = siapa pun bisa tulis/hapus)'
         ELSE 'info' END
  FROM storage.buckets b

  UNION ALL
  -- 6b. Policy di storage.objects (siapa boleh apa)
  SELECT
    7, '6b. Policy storage.objects',
    policyname,
    cmd || ' -> ' || array_to_string(roles::text[], ', '),
    CASE
      WHEN cmd IN ('INSERT','UPDATE','DELETE','ALL')
           AND ('anon' = ANY(roles::text[]) OR 'public' = ANY(roles::text[]))
        THEN 'PERIKSA (tulis/hapus untuk publik/anon)'
      ELSE 'info'
    END
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
)
SELECT pemeriksaan, item, detail, status
FROM hasil
ORDER BY
  CASE
    WHEN status LIKE 'MASALAH%' THEN 0
    WHEN status LIKE 'PERIKSA%' THEN 1
    ELSE 2
  END,
  urut, item;
