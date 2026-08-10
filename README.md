# Gina Boutique

Tienda en línea para el mercado de Honduras. Un solo backend con dos frontends:
web (desktop-first) y app Android (React Native / Expo).

> **Estado actual — Fase 1 de 3.** Ya están el monorepo, el modelo de datos y la
> API de autenticación + catálogo. La web, la app móvil, el carrito, el checkout
> con PixelPay y el panel de administración vienen en las siguientes fases (ver
> [Roadmap](#roadmap)).

## Stack

| Capa            | Tecnología                                        |
| --------------- | ------------------------------------------------- |
| Backend         | Node.js 22 + Express + TypeScript                 |
| Base de datos   | PostgreSQL (Railway) + Prisma ORM                 |
| Web             | React + Vite + TailwindCSS *(fase 2)*             |
| Android         | React Native + Expo *(fase 3)*                    |
| Autenticación   | JWT (access + refresh rotativo) + bcrypt          |
| Pagos           | PixelPay (sandbox primero) *(fase 2)*             |
| Hosting         | Railway (API y web como servicios separados)      |

## Estructura

```
/apps
  /api        Express + Prisma — la API que consumen web y mobile
  /web        React + Vite (fase 2)
  /mobile     React Native + Expo (fase 3)
/packages
  /shared     Tipos, constantes y validaciones zod compartidas
```

`@gina/shared` es la pieza clave: los 18 departamentos de Honduras, los estados
de orden, los DTOs y los schemas de validación viven ahí una sola vez, y los tres
apps los importan. Si cambias una regla de validación, cambia en los tres.

## Correr en local

Requisitos: Node 22+ y un PostgreSQL accesible (local o el de Railway).

```bash
git clone https://github.com/brocolyfa-boop/Gina_Boutique.git
cd Gina_Boutique
npm install

# 1. Configurar el entorno del backend
cp apps/api/.env.example apps/api/.env
# Editar apps/api/.env:
#   - DATABASE_URL: cópiala del plugin de Postgres en Railway (no la escribas a mano)
#   - JWT_SECRET y JWT_REFRESH_SECRET: genera cada uno con `openssl rand -base64 48`

# 2. Compilar el paquete compartido y generar el cliente de Prisma
npm run build -w @gina/shared
npm run db:generate -w @gina/api

# 3. Migrar y sembrar datos de prueba
npm run db:migrate      # aplica prisma/migrations
npm run db:seed         # 5 categorías, 15 productos, 2 promos, 2 usuarios

# 4. Levantar la API
npm run dev:api         # http://localhost:3000
```

Comprobación rápida: `curl http://localhost:3000/health`

Usuarios que crea el seed (**solo para desarrollo**, cambiar antes de producción):

| Rol     | Email                        | Contraseña     |
| ------- | ---------------------------- | -------------- |
| admin   | admin@ginaboutique.hn        | `Admin1234!`   |
| cliente | cliente@ginaboutique.hn      | `Cliente1234!` |

Otros comandos útiles: `npm run db:studio` (explorador de la base),
`npm run lint`, `npm run typecheck`.

## Variables de entorno

Todas viven en `apps/api/.env` (plantilla en `apps/api/.env.example`). El
servidor valida el entorno al arrancar con zod y **se niega a subir** si falta
algo — es mejor un deploy fallido que descubrir a mitad de un checkout que
faltaba `PIXELPAY_API_KEY`.

| Variable                | Para qué                                                     |
| ----------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`          | Postgres. Railway la genera al agregar el plugin.            |
| `JWT_SECRET`            | Firma de access tokens (mín. 32 caracteres).                 |
| `JWT_REFRESH_SECRET`    | Firma de refresh tokens. Distinto al anterior.               |
| `PIXELPAY_API_KEY`      | Credenciales de PixelPay.                                    |
| `PIXELPAY_API_SECRET`   | Credenciales de PixelPay.                                    |
| `PIXELPAY_MODE`         | `sandbox` o `production`.                                    |
| `CLOUDINARY_URL`        | Subida de imágenes de producto (opcional en desarrollo).     |
| `PORT`                  | Puerto HTTP. Railway lo inyecta solo.                        |
| `COSTO_ENVIO_LPS`       | Costo de envío en lempiras. Ver nota abajo.                  |
| `CORS_ORIGINS`          | Orígenes permitidos, separados por coma.                     |

### Sobre el costo de envío

El envío es fijo (65 LPS) y **no está hardcodeado en ningún frontend**. Vive en
`COSTO_ENVIO_LPS` y la API lo publica en `GET /api/config`. Así se puede subir a
70 u 80 lempiras cambiando una variable en Railway, sin recompilar la web ni
republicar el APK en Google Play.

## API

Base: `/api`. Todo devuelve JSON. Los errores siguen la forma
`{ "error": { "message", "code", "detalles?" } }`.

### Config pública

| Método | Ruta                       | Descripción                                     |
| ------ | -------------------------- | ----------------------------------------------- |
| GET    | `/config`                  | Costo de envío, moneda, modo de PixelPay        |
| GET    | `/config/departamentos`    | Los 18 departamentos con días estimados         |
| GET    | `/config/tallas`           | Catálogos de tallas de ropa y calzado           |

### Autenticación

| Método | Ruta             | Descripción                                       |
| ------ | ---------------- | ------------------------------------------------- |
| POST   | `/auth/registro` | Crear cuenta → `{ user, accessToken, refreshToken }` |
| POST   | `/auth/login`    | Iniciar sesión                                    |
| POST   | `/auth/refresh`  | Renovar sesión (rota el refresh token)            |
| POST   | `/auth/logout`   | Revocar el refresh token                          |
| GET    | `/auth/me`       | Perfil del usuario autenticado                    |
| PATCH  | `/auth/me`       | Actualizar nombre, teléfono o dirección           |

Los access tokens duran 15 minutos; el refresh 30 días. El refresh se guarda
**hasheado** en la base para poder revocar sesiones sin esperar a que expire, y
se rota en cada uso: reutilizar uno viejo devuelve 401. `/auth/login` y
`/auth/registro` tienen rate limit (20 intentos / 15 min por IP) y responden el
mismo mensaje para email inexistente y contraseña incorrecta.

### Catálogo

| Método | Ruta                         | Descripción                                    |
| ------ | ---------------------------- | ---------------------------------------------- |
| GET    | `/categorias`                | Categorías con su conteo de productos activos  |
| GET    | `/categorias/:slug`          | Una categoría con sus subcategorías            |
| GET    | `/productos`                 | Catálogo paginado con filtros                  |
| GET    | `/productos/sugerencias?q=`  | Autocompletado del buscador (máx. 8)           |
| GET    | `/productos/:id`             | Ficha con productos relacionados               |
| GET    | `/promociones`               | Solo las promos vigentes ahora mismo           |
| GET    | `/promociones/:id`           | Una promoción                                  |

Filtros de `/productos`: `q`, `categoria` (acepta slug o id), `subcategoria`,
`talla`, `color`, `precioMin`, `precioMax`, `destacado`, `enOferta`,
`orden` (`nuevos` \| `precio_asc` \| `precio_desc` \| `nombre`), `page`, `limit`
(máx. 60). Nunca devuelve el catálogo completo: la web pagina y la app móvil hace
scroll infinito sobre el mismo endpoint.

```bash
curl "http://localhost:3000/api/productos?categoria=mujer&talla=M&enOferta=true&limit=12"
```

### Administración

Requieren `Authorization: Bearer <accessToken>` de un usuario con rol `admin`:
`POST`/`PATCH`/`DELETE` sobre `/categorias`, `/productos` y `/promociones`, más
`GET /productos/admin/todos` y `GET /promociones/admin/todas` (que sí incluyen los
inactivos). Borrar un producto es baja lógica (`activo = false`) para que las
órdenes ya emitidas sigan apuntando a algo válido.

## Despliegue en Railway

1. **New Project → Deploy from GitHub repo →** `Gina_Boutique`.
2. **Add Plugin → PostgreSQL.** Railway crea `DATABASE_URL` sola.
3. En el servicio de la API: **Settings → Root Directory** = `apps/api`,
   *Build* = `npm run build`, *Start* = `npm start`.
   `npm start` corre `prisma migrate deploy` antes de arrancar, así que las
   migraciones se aplican solas en cada deploy.
4. **Settings → Variables:** agregar `JWT_SECRET`, `JWT_REFRESH_SECRET`,
   `PIXELPAY_*`, `COSTO_ENVIO_LPS` y `CORS_ORIGINS`. `PORT` la inyecta Railway.
5. Sembrar una vez, desde local apuntando a la base de Railway:
   `DATABASE_URL="<la de Railway>" npm run db:seed`

Considera pasar el repo a privado antes de subir la lógica de pagos:
Settings → General → Danger Zone → Change visibility.

## Notas de seguridad

- Nunca se guardan números de tarjeta ni CVV. El checkout tokeniza con el SDK de
  PixelPay en el cliente y la API solo recibe el token (`pagoToken`).
- Contraseñas con bcrypt (12 rondas). Helmet, CORS por lista blanca y límite de
  1 MB en el body.
- El costo de envío y los totales se recalculan **en el backend** al crear la
  orden; lo que manda el cliente no se toma como cierto.

## Roadmap

- [x] **Fase 1** — Monorepo, `@gina/shared`, Prisma schema + migración, API de
      auth y catálogo, seed, CI.
- [ ] **Fase 2** — Carrito y órdenes, integración PixelPay, frontend web (home,
      catálogo, ficha, carrito, checkout con marco blanco, login) y panel `/admin`.
- [ ] **Fase 3** — App Android con Expo (bottom tabs, scroll infinito) y build
      `.aab` con `eas build -p android`.

## Pendientes de definir

- **Logo y color de marca.** Están como placeholder en
  `packages/shared/src/constants.ts` (`MARCA.logoUrl` y `MARCA.colores.primary`,
  hoy `#B03052`). Al reemplazarlos ahí, web y mobile los toman de una sola vez.
