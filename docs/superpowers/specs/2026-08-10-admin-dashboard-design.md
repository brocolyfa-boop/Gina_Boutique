# Diseño: panel administrador completo de Gina Boutique

## Objetivo

Reemplazar el panel administrativo actual por una experiencia independiente del
panel del cliente, orientada a operar la tienda: analizar ventas, administrar
productos e imágenes, configurar promociones, controlar inventario y gestionar
pedidos.

## Estructura del panel

El administrador tendrá navegación propia y módulos separados:

- **Dashboard:** indicadores, filtros y gráficos interactivos.
- **Productos:** crear, editar, duplicar, ocultar y eliminar productos.
- **Categorías:** administrar categorías, subcategorías e imágenes de categoría.
- **Promociones:** crear ofertas con imagen, descuento, alcance y vigencia.
- **Inventario:** existencias, stock bajo y movimientos relevantes.
- **Pedidos:** búsqueda, filtros, detalle y cambio de estado.

El panel seguirá protegido por el rol administrador existente. El cliente no
verá estos módulos ni sus acciones.

## Dashboard y zonas de venta

El dashboard tendrá filtros por período (hoy, 7 días, mes, trimestre y rango
personalizado), departamento, municipio, categoría, producto y estado del
pedido.

Los indicadores y gráficos incluirán:

- ventas totales, pedidos, ticket promedio y unidades vendidas;
- ventas e ingresos por departamento y municipio;
- mapa de Honduras con intensidad por zona;
- ranking de zonas con más pedidos e ingresos;
- productos y categorías más vendidos;
- stock bajo y productos sin inventario;
- evolución temporal de ventas y pedidos.

Las zonas se obtendrán de `departamento` y `municipio` ya presentes en las
direcciones de los pedidos. Los agregados se calcularán en la API y el panel
solo visualizará datos autorizados del entorno administrativo.

## Formulario de productos

El formulario se dividirá en pestañas para evitar una pantalla saturada:

### Información

- nombre;
- descripción;
- marca, material y tipo de prenda;
- categoría y subcategoría;
- SKU o código interno.

### Precios y oferta

- precio normal;
- precio de oferta opcional;
- fecha de inicio y finalización de la oferta;
- estado activo y producto destacado.

### Fotos

- selección de varias imágenes desde el computador;
- vista previa antes de guardar;
- orden de imágenes;
- eliminación y selección de imagen principal;
- subida a Cloudinary y persistencia de las URLs en PostgreSQL.

### Tallas y medidas

- tallas disponibles;
- colores;
- pecho, cintura, cadera, largo, manga y tiro;
- guía de tallas y observaciones.

### Inventario y envío

- stock total;
- peso;
- alto, ancho y profundidad del paquete;
- estado de publicación.

Los campos nuevos serán opcionales cuando no apliquen a un producto, para no
romper los productos existentes.

## Promociones

El administrador podrá crear y editar promociones con:

- título, descripción e imagen;
- descuento porcentual o monto fijo;
- categoría, productos específicos o catálogo completo;
- fecha de inicio y fecha de finalización;
- estado activa/inactiva;
- vista previa del banner.

La API determinará si una promoción está vigente por fecha y estado. El cliente
solo mostrará promociones activas y vigentes.

## Persistencia y archivos

PostgreSQL será la fuente de verdad para usuarios, productos, categorías,
inventario, promociones, pedidos, medidas y metadatos de imágenes. Cloudinary
almacenará los archivos binarios y devolverá URLs optimizadas; esas URLs se
guardarán en PostgreSQL.

La credencial `CLOUDINARY_URL` permanecerá únicamente en el servicio de la API
en Railway. Nunca se enviará al navegador.

## Fases de implementación

1. Modelo de datos y endpoints administrativos.
2. Dashboard, filtros, métricas y gráficos.
3. Gestión de productos, categorías e imágenes.
4. Promociones programadas y banners.
5. Inventario y pedidos.
6. Validaciones, permisos, pruebas y despliegue.

Cada fase se probará antes de publicar la siguiente.

