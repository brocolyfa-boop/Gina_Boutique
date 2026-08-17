# Diagnóstico — "⚠️ PDF no disponible" en REG-PR-DH-24

Proyecto Apps Script (productivo, solo lectura para este análisis):
`12FcF08bJrBcdKjA4a3KBdknP1K4hCNHFB7uJvNoS8WjFxh4hSazxkgoN` — "REG-PR-DH-24"

El mensaje `⚠️ PDF no disponible` sale de un solo lugar: `notificarSupervisor()`,
cuando `generarPDF()` devuelve `null`. Y `generarPDF()` devuelve `null` **siempre
que algo dentro de su `try` truena**, porque atrapa el error, lo manda a
`Logger.log('ERROR generarPDF: ...')` y sigue. Es decir: el correo se envía igual,
sin adjunto, y la causa real queda escondida en el log de ejecuciones.

## Causa #1 (la más probable) — el web app corre como el usuario que accede

`appsscript.json`:

```json
"webapp": { "executeAs": "USER_ACCESSING", "access": "DOMAIN" }
```

Consecuencia: cuando Almacén aprueba desde el formulario, la cadena
`aprobarAlmacen() → verificarAprobacionFinal() → generarPDF()` se ejecuta con la
identidad de **lcruz@ / ccarranza@ / lzelaya@**, no con la del dueño del script.

`generarPDF()` necesita, con esa identidad:

- `DriveApp.getFileById(docId)` y `DocumentApp.openById(docId)` → **editor** del Doc en PENDIENTES
- `body.replaceText(...)` + `doc.saveAndClose()` → escritura en ese Doc
- `UrlFetchApp.fetch(.../export)` con `ScriptApp.getOAuthToken()` → el token es del usuario que accede
- `DriveApp.getFolderById(CFG.APRO_ID).createFile(...)` → **editor** de la carpeta APROBADOS
- `docFile.setTrashed(true)` → **propietario/editor** del Doc

Si a esos usuarios les falta permiso en cualquiera de esos IDs (`PEND_ID`,
`APRO_ID`, el Doc), revienta y el resultado es exactamente el síntoma reportado.

Esto también explica por qué `pruebaPDF()` **sí funciona**: al correrla desde el
editor se ejecuta como el dueño, que tiene todos los permisos. La prueba nunca
recorre el camino que falla.

### Arreglo

Dos opciones; la primera es la recomendada.

1. **Cambiar el despliegue a "Ejecutar como: yo"**
   (Implementar → Administrar implementaciones → editar → *Ejecutar como: Yo*,
   *Quién tiene acceso: Cualquier usuario de la organización*), o en
   `appsscript.json`:

   ```json
   "webapp": { "executeAs": "USER_DEPLOYING", "access": "DOMAIN" }
   ```

   El código no depende de `Session.getActiveUser()` para identificar a nadie —
   el responsable se captura como texto en los formularios (`responsable`,
   `inspector`) — así que el cambio no altera la trazabilidad del registro.
   **Hay que crear una nueva versión de la implementación** para que aplique, y
   los usuarios volverán a ver la pantalla de autorización una vez.

2. Si por política debe seguir en `USER_ACCESSING`: dar acceso de **editor** a
   `PEND_ID`, `APRO_ID`, `RECH_ID` y a la plantilla a los correos de Almacén y
   Calidad. Es más frágil y se rompe con cada usuario nuevo.

## Causa #2 — reprocesos: el Doc origen ya fue eliminado

`generarPDF()` termina con:

```js
try { docFile.setTrashed(true); } catch(e) { ... }
```

El Doc origen se manda a la papelera, pero **`DOC_ID` (col. 29) se queda en la
hoja**. Entonces, al reprocesar (`reprocesarRegistroSinPDF()`,
`reprocesarTodosAtascados()`, o una segunda aprobación), `generarPDF()` toma ese
`DOC_ID` de un archivo en papelera, y el fallback por nombre en PENDIENTES no lo
encuentra porque `getFilesByName()` / `getFiles()` no listan archivos en papelera
→ `Error('Documento no encontrado en PENDIENTES: ' + ref)` → `null` →
"PDF no disponible".

### Arreglo sugerido

En lugar de borrar el Doc, moverlo a APROBADOS (queda evidencia y el reproceso
funciona), o al menos limpiar `DOC_ID` cuando se manda a papelera:

```js
// en generarPDF(), reemplazar el setTrashed por:
try { docFile.moveTo(carpApro); } catch(e) { Logger.log('⚠️ No se pudo mover doc: ' + e.message); }
```

Si se prefiere conservar el borrado, agregar justo después:

```js
try {
  var _r = getRegistro(ref);
  if (_r.ok) SpreadsheetApp.openById(CFG.SS_ID).getSheetByName('Detalle')
    .getRange(_r.fila, COL.DOC_ID + 1).setValue('');
} catch(e) {}
```

## Causa #3 — el error real nunca se ve

`generarPDF()` se traga la excepción. Recomendado: propagar el motivo al correo
para no depender del log:

```js
} catch (e) {
  Logger.log('ERROR generarPDF: ' + e.message + ' | ' + (e.stack || ''));
  ULTIMO_ERROR_PDF = e.message;   // var global, se muestra en el correo
  return null;
}
```

y en `notificarSupervisor()`:

```js
: '<p style="color:#dc2626;text-align:center">⚠️ PDF no disponible' +
  (ULTIMO_ERROR_PDF ? ' — ' + ULTIMO_ERROR_PDF : '') + '</p>')
```

## Observaciones menores (no causan el fallo, sí lo agravan)

- `Utilities.sleep(4000)` entre `saveAndClose()` y el export es una espera fija.
  Si el export devuelve HTTP ≠ 200 conviene reintentar 2–3 veces con espera
  creciente antes de rendirse; hoy un 429/500 transitorio pierde el PDF y el Doc
  ya fue borrado.
- `verificarAprobacionFinal()` usa `LINK_PDF === ''` como candado antidoble
  notificación. Como un fallo de PDF deja la celda vacía, una segunda aprobación
  vuelve a notificar (correo duplicado sin adjunto).
- `hoja.getRange(fila, 1, 1, 28)` no incluye la columna 29 (`DOC_ID`); no rompe
  nada porque `generarPDF()` lo relee vía `getRegistro()`, pero es una
  inconsistencia a vigilar si algún día se lee `datos[COL.DOC_ID]`.
- `submitOperario()` usa `hoja.getLastRow()` después de `appendRow()` para
  escribir `DOC_ID`. Con dos operarios enviando a la vez puede escribir el
  `DOC_ID` en la fila del otro. Más seguro: guardar la fila con
  `getRegistro(ref).fila`.

## Cómo verificar sin romper nada

Pegar `diagnostico-pdf.gs` (en esta misma carpeta) como archivo **nuevo** en el
proyecto y ejecutar `diagnosticoPDF()`. No escribe en la hoja, no borra nada, no
manda correo: solo comprueba acceso a cada ID de `CFG`, el export del template a
PDF y los permisos efectivos, e imprime el resultado en el log.

Luego, para la prueba de punta a punta con correo, usar la `pruebaPDF()` que ya
existe (envía solo a ctorres@) — pero recordar que **no reproduce la Causa #1**,
porque corre como el dueño. Para reproducir el fallo real hay que aprobar desde
el web app con la cuenta de Almacén.
