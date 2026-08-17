# REG-PR-DH-24 — Detector de Metales (Planta Deshidratados)

Fuente del proyecto Apps Script `12FcF08bJrBcdKjA4a3KBdknP1K4hCNHFB7uJvNoS8WjFxh4hSazxkgoN`,
bajo control de versiones. El diagnóstico del fallo de PDF está en
[`docs/appsscript/diagnostico-pdf-REG-PR-DH-24.md`](../../docs/appsscript/diagnostico-pdf-REG-PR-DH-24.md).

## Requisitos

```bash
npm install -g @google/clasp
clasp login          # una vez; deja el token en ~/.clasprc.json
```

Y la Google Apps Script API activada en https://script.google.com/home/usersettings.

## Uso

```bash
cd appsscript/REG-PR-DH-24

clasp pull           # traer lo que está hoy en producción
clasp push           # subir esta carpeta al proyecto
clasp open           # abrir el editor en el navegador
clasp logs           # ver el log de ejecuciones
```

`clasp push` **sobrescribe** el proyecto productivo. Antes de subir, un
`clasp pull` en una copia limpia para confirmar que no hay cambios hechos a mano
en el editor que se perderían.

## Cambios aplicados sobre la versión productiva

1. **`appsscript.json` → `executeAs: "USER_DEPLOYING"`** (antes `USER_ACCESSING`).
   Era la causa principal de "⚠️ PDF no disponible": `generarPDF()` corría con la
   identidad del usuario que aprobaba (Almacén/Calidad), que no necesariamente
   tiene permiso de edición sobre el Doc, PENDIENTES y APROBADOS.

   Requiere **crear una versión nueva de la implementación** para que aplique
   (Implementar → Administrar implementaciones → editar → guardar). Los usuarios
   verán la pantalla de autorización una vez más.

2. **`generarPDF()` ya no manda el Doc origen a la papelera**; lo mueve a
   APROBADOS. Antes el `DOC_ID` guardado en la hoja apuntaba a un archivo en
   papelera y los reprocesos fallaban con "Documento no encontrado en
   PENDIENTES", porque los iteradores de Drive no listan papelera.

3. **Export a PDF con 3 reintentos** y espera creciente. Antes un HTTP 429/500
   transitorio perdía el PDF de forma definitiva, y el Doc origen ya había sido
   borrado.

4. **El motivo real del fallo viaja al correo** (`ULTIMO_ERROR_PDF`), en vez de
   quedar solo en el log. Si vuelve a fallar, el correo dice por qué.

5. **`submitOperario()` localiza la fila por REF** para escribir `DOC_ID`, en vez
   de `getLastRow()`. Con dos operarios enviando a la vez, `getLastRow()` podía
   escribir el `DOC_ID` en la fila del otro registro.

## Verificación

`Diagnostico.gs` es no destructivo: no escribe en la hoja, no borra archivos y no
envía correo.

- `diagnosticoPDF()` — comprueba acceso a cada ID de `CFG`, escritura en
  APROBADOS, el export Doc→PDF y la cuota de correo.
- `diagnosticoRegistro()` — estado de un registro puntual (cambiar la constante
  `REF` dentro de la función).

Para la prueba de punta a punta con correo, `pruebaPDF()` envía solo a
`ctorres@industrialdealimentos.com`. Ojo: corriéndola desde el editor se ejecuta
como el dueño, así que **no reproduce** el fallo original. Para eso hay que
aprobar desde el web app con la cuenta de Almacén.
