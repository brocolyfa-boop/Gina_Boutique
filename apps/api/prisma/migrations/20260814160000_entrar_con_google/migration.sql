-- Entrar con Google.
--
-- `password_hash` pasa a ser opcional: una cuenta creada con Google no tiene
-- contraseña que guardar. Las cuentas que ya existen conservan la suya, así que
-- quitar el NOT NULL no toca ningún dato.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- El `sub` de Google: su identificador de usuario, que no cambia aunque la
-- persona cambie de correo. Único, para que dos cuentas no puedan reclamar la
-- misma identidad de Google.
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
