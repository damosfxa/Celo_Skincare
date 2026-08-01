BEGIN;

-- Fix reproducibility gap: 0102 mendefinisikan fn_inspect_return dengan 4
-- parameter, lalu 0106 CREATE OR REPLACE dengan 5 parameter (nambah
-- p_expiry_date). Postgres membedakan fungsi berdasarkan SELURUH tipe
-- parameter (bukan cuma nama) -- jadi CREATE OR REPLACE dengan signature
-- beda TIDAK mengganti fungsi lama, malah bikin overload baru. Rebuild
-- dari nol lewat urutan file migration ini bakal ninggalin 2 versi
-- fn_inspect_return sekaligus, padahal cuma versi 5-parameter yang
-- dipanggil aplikasi -- persis drift yang migration README ini didesain
-- untuk dicegah.
DROP FUNCTION IF EXISTS fn_inspect_return(uuid, text, uuid, text);

COMMIT;
