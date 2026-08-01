-- Cleanup order_items dari 2 test volume import (500 order PENDING,
-- gak pernah di-ship jadi gak pernah sentuh ledger/stok sama sekali --
-- cleanup ini murni buang order_items-nya, order induknya dibiarkan
-- jadi wadah kosong seperti pola cleanup sebelumnya).

BEGIN;

DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders
  WHERE external_order_id LIKE 'QATEST-VOLUME-%'
     OR external_order_id LIKE 'QATEST-VOLUME2-%'
);

COMMIT;
