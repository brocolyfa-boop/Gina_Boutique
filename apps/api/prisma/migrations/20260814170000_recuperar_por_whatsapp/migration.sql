-- Recuperar la contraseña con un código por WhatsApp.
--
-- La misma tabla sirve para los dos caminos: el enlace por correo (token_hash)
-- y el código de 6 dígitos por WhatsApp (codigo_hash). Son la misma idea —una
-- recuperación pendiente— y separarlas en dos tablas obligaría a consultar las
-- dos en cada paso.

-- El enlace por correo pasa a ser opcional: una recuperación por WhatsApp no
-- tiene token. Postgres permite varios NULL en un índice único, así que la
-- restricción sigue valiendo para los que sí lo tienen.
ALTER TABLE "password_resets" ALTER COLUMN "token_hash" DROP NOT NULL;

ALTER TABLE "password_resets" ADD COLUMN "codigo_hash" TEXT;
ALTER TABLE "password_resets" ADD COLUMN "telefono" TEXT;
-- Tope de intentos: un código de 6 dígitos son un millón de combinaciones, que
-- un programa prueba en minutos si se le deja.
ALTER TABLE "password_resets" ADD COLUMN "intentos" INTEGER NOT NULL DEFAULT 0;
-- Nulo = la tienda todavía no se lo mandó al cliente.
ALTER TABLE "password_resets" ADD COLUMN "enviado_at" TIMESTAMP(3);

CREATE INDEX "password_resets_telefono_idx" ON "password_resets"("telefono");
