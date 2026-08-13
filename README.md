# Gina Boutique

Tienda en línea para el mercado de Honduras. Un solo backend con dos frontends:
web (desktop-first) y app Android (React Native / Expo).

> **Estado actual — Fases 1 y 2 completas y desplegadas.**
>
> - Tienda: https://ginaweb-production.up.railway.app
> - API: https://ginaboutique-production.up.railway.app
>
> Falta la app Android (fase 3) y conectar una pasarela de tarjeta (ver
> [Roadmap](#roadmap)).

## Stack

| Capa            | Tecnología                                        |
| --------------- | ------------------------------------------------- |
| Backend         | Node.js 22 + Express + TypeScript                 |
| Base de datos   | PostgreSQL (Railway) + Prisma ORM                 |
| Web             | React + Vite + TailwindCSS + React Query          |
| Android         | React Native + Expo *(fase 3)*                    |
| Autenticación   | JWT (access + refresh rotativo) + bcrypt          |
| Pagos           | Contra entrega. Tarjeta: interfaz lista, sin conectar |
| Hosting         | Railway (API y web como servicios separados)      |

## Estructura

```
/apps
  /api        Express + Prisma — la API que consumen web y mobile
  /web        React + Vite — la tienda
  /mobile     React Native + Expo (fase 3, pendiente)
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
npm run db:seed         # 5 categorías, 15 productos de ejemplo, 2 usuarios

# 4. (Opcional) Cargar el catálogo real y desactivar el de ejemplo
npm run db:catalogo -w @gina/api

# 5. Levantar la API y la web (en dos terminales)
npm run dev:api         # http://localhost:3000
npm run dev:web         # http://localhost:5173
```

La web hace proxy de `/api` a `localhost:3000` en desarrollo, así que no hay que
configurar CORS ni `VITE_API_URL` para trabajar en local.

Comprobación rápida: `curl http://localhost:3000/health`

Usuarios que crea el seed (**solo para desarrollo**, cambiar antes de producción):

| Rol     | Email                        | Contraseña     |
| ------- | ---------------------------- | -------------- |
| admin   | admin@ginaboutique.hn        | `Admin1234!`   |
| cliente | cliente@ginaboutique.hn      | `Cliente1234!` |

> Estas credenciales están publicadas en este archivo, así que **no sirven para
> producción**. Cambia la contraseña del administrador desde el panel antes de
> exponer la tienda.

Otros comandos útiles: `npm run db:studio` (explorador de la base),
`npm run lint`, `npm run typecheck`, y `npm test -w @gina/shared` para las
pruebas de las reglas de dinero (precio de oferta, promociones y envío por
zona), que también corren en CI.

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
| `PORT`                  | Puerto HTTP. Railway lo inyecta solo.                        |
| `COSTO_ENVIO_TEGUCIGALPA_LPS` | Envío dentro de Tegucigalpa. Ver nota abajo.           |
| `COSTO_ENVIO_NACIONAL_LPS` | Envío al resto del país.                                  |
| `CLOUDINARY_URL`        | Subida de fotos de producto desde el panel.                  |
| `CORS_ORIGINS`          | Orígenes permitidos, separados por coma.                     |

### Sobre el costo de envío

El envío depende de la zona, como cobra la mensajería: **L 90 dentro de
Tegucigalpa y L 120 al resto del país**, con entrega de 1 a 2 días. Vive en
`COSTO_ENVIO_TEGUCIGALPA_LPS` y `COSTO_ENVIO_NACIONAL_LPS`, y la API lo publica
en `GET /api/config`. Así se puede ajustar cuando la mensajería cambie sus
precios, sin recompilar la web ni republicar el APK.

La zona se decide con `esTegucigalpa()` en `@gina/shared`, que acepta las formas
en que un cliente escribe la capital: "Tegucigalpa", "Distrito Central",
"Comayagüela", con o sin acentos.

El carrito muestra la tarifa **más barata como estimación** (todavía no conoce la
dirección) y lo marca como tal; el checkout muestra la real al elegir
departamento y municipio, y la API la recalcula al crear la orden. El cliente
nunca decide cuánto paga de envío.

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

### Carrito

| Método | Ruta                       | Descripción                                    |
| ------ | -------------------------- | ---------------------------------------------- |
| GET    | `/carrito`                 | Carrito con subtotal, envío y total            |
| POST   | `/carrito/items`           | Agregar (suma si la línea ya existe)           |
| PATCH  | `/carrito/items/:itemId`   | Cambiar cantidad (`0` elimina la línea)        |
| DELETE | `/carrito/items/:itemId`   | Quitar una línea                               |
| DELETE | `/carrito`                 | Vaciar                                         |
| POST   | `/carrito/sincronizar`     | Fusionar el carrito de invitado al entrar      |

Requieren sesión. El invitado guarda su carrito en `localStorage`/`AsyncStorage`
y lo sube con `/sincronizar` al iniciar sesión; las líneas que ya existían se
quedan con la cantidad **mayor**, no con la suma (2 en el teléfono y 2 en la web
significa que quiere 2, no 4), y las inválidas se descartan devolviendo la lista
en `descartadas` en vez de fallar toda la operación.

Al agregar se valida contra el producto real: que exista, esté activo, tenga
stock, y que la talla y el color pedidos sean de los que ese producto ofrece.

### Órdenes y direcciones

| Método | Ruta                       | Descripción                                    |
| ------ | -------------------------- | ---------------------------------------------- |
| POST   | `/ordenes`                 | Crear orden (valida stock, cobra, vacía carrito) |
| GET    | `/ordenes`                 | Historial del cliente                          |
| GET    | `/ordenes/:id`             | Detalle (solo la propia, o cualquiera si admin)  |
| POST   | `/ordenes/:id/cancelar`    | Cancelar y devolver stock (solo si `pendiente`) |
| GET    | `/direcciones`             | Direcciones guardadas                          |
| POST   | `/direcciones`             | Guardar (la primera queda como principal)      |
| PATCH  | `/direcciones/:id`         | Editar                                         |
| DELETE | `/direcciones/:id`         | Borrar                                         |

Lo que **no** se le cree al cliente al crear una orden: los precios se releen de
la base, el costo de envío sale de `COSTO_ENVIO_LPS`, y el total se recalcula. El
número de orden (`GB-000123`) lo asigna una secuencia de Postgres, no un conteo
de filas — contar órdenes para numerar la siguiente se rompe con dos compras
simultáneas.

El stock se descuenta con un `UPDATE` condicionado a `stock >= cantidad`: si dos
clientes compran la última unidad al mismo tiempo, uno recibe su orden y el otro
un mensaje claro, y el stock nunca queda negativo. Los `items` de la orden se
guardan como snapshot inmutable: cambiar el precio de un producto mañana no
altera las órdenes de ayer.

### Métodos de pago

`GET /api/config` devuelve solo los métodos **realmente cobrables**. Hoy eso es
`contra_entrega`; el pago con tarjeta aparecerá en la lista automáticamente en
cuanto haya credenciales configuradas.

#### Enlace de cobro por pedido

Mientras no haya pasarela, cada pedido admite un enlace de pago generado a mano
en la banca de la tienda. Desde **Panel → Pedidos → Cobro** se pega el enlace y
un botón se lo manda al cliente por WhatsApp con el resumen; el comprador
también lo ve en **Seguir mi pedido**.

Funciona con cualquier banco y sin contrato, pero la tienda **no se entera de si
el cliente pagó**: cuando el dinero aparece en la cuenta hay que cambiar el
estado del pedido a `pagado` a mano. El enlace se exige `https`, y desaparece
del seguimiento en cuanto el pedido está pagado, entregado o cancelado, para no
cobrar dos veces.

No hay ninguna pasarela cableada, a propósito. `apps/api/src/lib/pagos.ts`
define la interfaz `ProveedorPago`; para habilitar tarjeta se implementa esa
interfaz y se registra en `PROVEEDORES`. Nada del carrito, las órdenes ni el
checkout necesita cambiar. Si se pide una orden con un método no disponible, la
API la rechaza antes de tocar el stock, en vez de aceptar una compra que nunca se
podría cobrar.

### Administración

Requieren `Authorization: Bearer <accessToken>` de un usuario con rol `admin`:
`POST`/`PATCH`/`DELETE` sobre `/categorias`, `/productos` y `/promociones`, más
`GET /productos/admin/todos` y `GET /promociones/admin/todas` (que sí incluyen los
inactivos). Borrar un producto es baja lógica (`activo = false`) para que las
órdenes ya emitidas sigan apuntando a algo válido.

Para pedidos: `GET /ordenes/admin/todas` (filtrable con `?estado=`),
`PATCH /ordenes/:id/estado` y `GET /ordenes/admin/resumen`, que devuelve ventas
del día y de la semana, pedidos pendientes y los 10 productos más vendidos. Las
órdenes canceladas no cuentan como venta.

## Despliegue en Railway

Son **dos servicios** (API y web) sobre **una misma base de datos**, dentro del
mismo proyecto de Railway.

### Lo que NO hay que hacer

No pongas *Root Directory* en `apps/api` ni en `apps/web`. Esto es un monorepo
con workspaces de npm: los dos apps dependen de `@gina/shared`, que vive fuera de
esas carpetas. Si acotas el root, la build falla porque no encuentra el paquete
compartido. **Root Directory se deja vacío (la raíz del repo)** y se distingue
cada servicio por sus comandos.

### 1. Base de datos

**New Project → Add Plugin → PostgreSQL.** Railway crea `DATABASE_URL` sola; no
la escribas a mano.

### Cómo encuentra Railway la configuración

Railpack lee `railway.json` de la raíz del repo **sin que haya que configurar
nada**, y ese archivo describe el servicio de la API. Por eso la API no necesita
que le escribas comandos en la interfaz.

Es importante entender por qué: Railpack falla *antes* de compilar si no detecta
un comando de arranque, y en un monorepo el `package.json` de la raíz no tiene
`start` — es solo el contenedor de los workspaces. El `railway.json` de la raíz
se lo dice antes de que llegue a rendirse.

El servicio de la web sí necesita un ajuste, porque los dos salen del mismo repo
y solo uno puede usar el archivo por defecto: se le indica
`apps/web/railway.json` en *Settings → Config-as-code*.

### 2. Servicio de la API

**New Service → GitHub Repo →** `Gina_Boutique`. En *Settings*:

| Campo            | Valor                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Root Directory   | *(vacío)*                                                                     |
| Build / Start    | *no tocar* — los toma de `railway.json` en la raíz del repo                   |

Variables (*Settings → Variables*):

- `DATABASE_URL` → referenciar la del plugin de Postgres
- `JWT_SECRET` y `JWT_REFRESH_SECRET` → `openssl rand -base64 48` cada uno
- `COSTO_ENVIO_LPS` → `65`
- `CORS_ORIGINS` → la URL pública de la web (paso 3). Sin esto el navegador
  bloquea todos los POST y no se puede ni iniciar sesión.

`npm start` corre `prisma migrate deploy` antes de arrancar, así que las
migraciones se aplican solas en cada deploy.

Luego **Settings → Networking → Generate Domain** para obtener la URL pública.

### 3. Servicio de la web

**New Service → GitHub Repo →** el mismo repo. En *Settings*:

| Campo            | Valor                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Root Directory   | *(vacío)*                                                                     |
| Config-as-code   | `apps/web/railway.json`                                                       |

Variable:

- `VITE_API_URL` → la URL pública de la API, sin barra final
  (ej. `https://gina-api.up.railway.app`)

Ojo con `VITE_API_URL`: Vite la incrusta **en el momento de compilar**, no la lee
al arrancar. Si la cambias después, hay que volver a desplegar para que surta
efecto.

`npm start` levanta `apps/web/server.js`, un servidor estático con *fallback* a
`index.html`. Esto no es un adorno: sin él, entrar directo a `/catalogo` o
recargar en `/producto/abc` daría 404, porque en el disco solo existe
`index.html` y el enrutado ocurre en el navegador.

### 4. Cerrar el círculo del CORS

Con la URL de la web ya generada, vuelve al servicio de la API y pon esa URL en
`CORS_ORIGINS`. Es el paso que más se olvida y el síntoma es confuso: el catálogo
carga (son GET) pero iniciar sesión o comprar falla.

### 5. Sembrar datos (una sola vez)

Desde tu máquina, apuntando a la base de Railway:

```bash
DATABASE_URL="<la DATABASE_URL de Railway>" npm run db:seed
```

Cambia la contraseña del usuario admin antes de abrir la tienda al público.

### Nota sobre la rama

Railway despliega desde la rama que le indiques, `main` por defecto. El trabajo
de las fases 2 y 3 va en `claude/gina-boutique-setup-vetm41`, así que **hay que
mezclar el PR a `main`** (o apuntar Railway a esa rama) para que lo desplegado
incluya la tienda y no solo la API.

Considera pasar el repo a privado antes de conectar cobros con tarjeta:
Settings → General → Danger Zone → Change visibility.

## Notas de seguridad

- Nunca se guardan números de tarjeta ni CVV. El checkout tokeniza con el SDK de
  PixelPay en el cliente y la API solo recibe el token (`pagoToken`).
- Contraseñas con bcrypt (12 rondas). Helmet, CORS por lista blanca y límite de
  1 MB en el body.
- El costo de envío y los totales se recalculan **en el backend** al crear la
  orden; lo que manda el cliente no se toma como cierto.
- El precio también: catálogo, carrito y cobro usan el mismo
  `precioConPromociones`, así que lo que se muestra es lo que se cobra.
- El seguimiento de pedidos de invitado pide número **y** teléfono, y responde
  lo mismo si no coincide que si no existe: distinguirlos permitiría averiguar
  qué números de pedido hay.

### Cuidado con las promociones

Desde que las promociones descuentan de verdad, **crear una afecta precios reales**.
Las que siembra el seed nacen desactivadas justamente por eso. Antes de publicar
la tienda, revisa en el panel que no quede ninguna activa sin querer.

## Roadmap

- [x] **Fase 1** — Monorepo, `@gina/shared`, Prisma schema + migración, API de
      auth y catálogo, seed, CI.
- [x] **Fase 2a** — Carrito persistente, órdenes con control de stock,
      direcciones, dashboard de admin y la interfaz de pagos.
- [x] **Fase 2b** — Frontend web: home, catálogo, ficha, carrito, checkout con
      marco blanco, login y panel `/admin`.
- [ ] **Fase 3** — App Android con Expo (bottom tabs, scroll infinito) y build
      `.aab` con `eas build -p android`.

## Identidad de marca

Definida en `packages/shared/src/constants.ts` (`MARCA`), en un solo lugar del
que tiran web y mobile.

- **Nombre:** Gina Boutique · **Tagline:** *Descubre la moda que te hace brillar*
- **Color principal: blanco** (`#FFFFFF`), con negro (`#111111`) como tinta.
- **Logo:** monograma "GR" en negro sobre blanco, serif de alto contraste.

El logo original trae el texto "GR VARIEDADES", pero el nombre de la tienda es
**Gina Boutique**. El monograma se usa como imagen (header, favicon) y el nombre
va aparte en texto; en el header, los correos y las órdenes siempre dice
"Gina Boutique".

Una marca blanca invierte la lógica normal de una paleta: el blanco es el lienzo,
no la tinta. Por eso `MARCA.colores` incluye `contraste` (`#111111`) para
tipografía y botones, `borde` para separar superficies blancas entre sí, y un
`fondo` blanco roto (`#FAF9F8`) para que las tarjetas blancas resalten. **Nunca
uses `primary` como color de texto ni de fondo de botón** — desaparecería.

Ventaja para el checkout: el "marco blanco" que pediste para el formulario de
pago deja de ser un parche y pasa a ser coherente con la marca. La separación se
logra con borde, sombra suave y el blanco roto del fondo, no con color.

### Pendiente

- **Subir el archivo del logo.** `MARCA.logoUrl` apunta a un placeholder hasta
  que el PNG esté en Cloudinary; al cambiar esa URL, los tres apps lo toman.
