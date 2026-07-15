-- ============================================================
-- 0103_schema_triggers.sql
-- Pasang trigger yang function-nya sudah didefinisikan di 0102.
-- ============================================================

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at
before update on products
for each row execute function set_updated_at();

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row execute function set_updated_at();

-- Trigger di schema auth (bukan public) -- baris profiles otomatis
-- dibuat begitu ada user baru signup lewat Supabase Auth.
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function fn_handle_new_user();
