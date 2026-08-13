-- Compra sin cuenta.
--
-- `user_id` pasa a ser opcional y la orden guarda el nombre (y opcionalmente el
-- correo) de quien compró. Antes se leía del usuario; un invitado no tiene de
-- dónde leerlo, y en una compra con cuenta el nombre pudo cambiar después: la
-- orden debe decir a quién se le entregó ese día.

ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_fkey";

ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "orders" ADD COLUMN "email_cliente" TEXT;
-- Se agrega opcional y se rellena antes de exigirla: la columna no puede nacer
-- NOT NULL en una tabla que ya tiene pedidos.
ALTER TABLE "orders" ADD COLUMN "nombre_cliente" TEXT;

UPDATE "orders" o
SET "nombre_cliente" = u."nombre",
    "email_cliente"  = u."email"
FROM "users" u
WHERE u."id" = o."user_id";

-- Por si alguna orden quedó huérfana de usuario.
UPDATE "orders" SET "nombre_cliente" = 'Cliente' WHERE "nombre_cliente" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "nombre_cliente" SET NOT NULL;

-- Al borrar la cuenta la orden sobrevive sin dueño: la venta ocurrió y el
-- reporte histórico no debe cambiar.
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
