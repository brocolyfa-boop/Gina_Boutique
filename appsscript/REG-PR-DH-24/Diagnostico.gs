// ============================================================
// DIAGNÓSTICO NO DESTRUCTIVO — "PDF no disponible"
// Proyecto: REG-PR-DH-24
//
// Pegar como archivo NUEVO en el proyecto y ejecutar diagnosticoPDF().
// NO escribe en la hoja, NO borra archivos, NO envía correo.
// Solo lee y reporta en el log (Ver → Registros de ejecución).
// ============================================================

function diagnosticoPDF() {
  var L = [];
  var log = function(s) { L.push(s); Logger.log(s); };

  log('════════ DIAGNÓSTICO PDF ════════');
  log('Ejecutando como: ' + (function(){
    try { return Session.getEffectiveUser().getEmail() || '(desconocido)'; }
    catch(e) { return 'ERROR: ' + e.message; }
  })());
  log('Usuario activo: ' + (function(){
    try { return Session.getActiveUser().getEmail() || '(sin permiso para verlo)'; }
    catch(e) { return 'ERROR: ' + e.message; }
  })());

  // ── 1. Acceso a cada ID de configuración ──
  log('\n── 1. Acceso a IDs de CFG ──');
  var ids = [
    ['SS_ID (hoja Detalle)', CFG.SS_ID,          'file'],
    ['COD_SS_ID',            CFG.COD_SS_ID,      'file'],
    ['TEMPLATE_ID',          CFG.TEMPLATE_ID,    'file'],
    ['MATRIZ_ID',            CFG.MATRIZ_ID,      'file'],
    ['PERSONAL_SS_ID',       CFG.PERSONAL_SS_ID, 'file'],
    ['PEND_ID (carpeta)',    CFG.PEND_ID,        'folder'],
    ['RECH_ID (carpeta)',    CFG.RECH_ID,        'folder'],
    ['APRO_ID (carpeta)',    CFG.APRO_ID,        'folder']
  ];

  for (var i = 0; i < ids.length; i++) {
    var nombre = ids[i][0], id = ids[i][1], tipo = ids[i][2];
    try {
      var obj    = (tipo === 'folder') ? DriveApp.getFolderById(id) : DriveApp.getFileById(id);
      var acceso = obj.getAccess(Session.getEffectiveUser());
      var puedeEditar = (String(acceso) === 'OWNER' || String(acceso) === 'EDIT');
      log((puedeEditar ? '✅' : '⚠️') + ' ' + nombre + ' → "' + obj.getName() + '" | acceso: ' + acceso);
      if (!puedeEditar) log('     ⚠️ SIN permiso de edición: generarPDF() fallará aquí.');
    } catch (e) {
      log('❌ ' + nombre + ' → ' + e.message);
    }
  }

  // ── 2. Permiso de escritura real en APROBADOS ──
  log('\n── 2. Escritura en carpeta APROBADOS ──');
  try {
    var carp  = DriveApp.getFolderById(CFG.APRO_ID);
    var tmp   = carp.createFile(Utilities.newBlob('diagnostico', 'text/plain', '__diagnostico_tmp.txt'));
    tmp.setTrashed(true);   // solo el archivo temporal recién creado
    log('✅ Se puede crear (y limpiar) archivos en APROBADOS.');
  } catch (e) {
    log('❌ NO se puede escribir en APROBADOS: ' + e.message);
  }

  // ── 3. Export a PDF vía Drive v3 (sobre la PLANTILLA, no toca registros) ──
  log('\n── 3. Export Doc → PDF (Drive v3) ──');
  try {
    var token = ScriptApp.getOAuthToken();
    var url   = 'https://www.googleapis.com/drive/v3/files/' + CFG.TEMPLATE_ID
              + '/export?mimeType=application%2Fpdf';
    var resp  = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code === 200) {
      log('✅ Export OK | HTTP 200 | bytes: ' + resp.getContent().length);
    } else {
      log('❌ Export falló | HTTP ' + code + ' | ' + resp.getContentText().substring(0, 400));
      log('     Revisar scopes del token y permisos sobre TEMPLATE_ID.');
    }
  } catch (e) {
    log('❌ Export lanzó excepción: ' + e.message);
  }

  // ── 4. Cuota de correo restante ──
  log('\n── 4. Cuota MailApp ──');
  try {
    var q = MailApp.getRemainingDailyQuota();
    log((q > 0 ? '✅' : '❌') + ' Correos restantes hoy: ' + q);
  } catch (e) {
    log('❌ No se pudo leer la cuota: ' + e.message);
  }

  // ── 5. Configuración del despliegue ──
  log('\n── 5. Despliegue ──');
  log('URL del web app: ' + (function(){
    try { return ScriptApp.getService().getUrl() || '(no desplegado)'; }
    catch(e) { return 'ERROR: ' + e.message; }
  })());
  log('Nota: appsscript.json declara executeAs="USER_ACCESSING". Si el usuario');
  log('activo de arriba NO es el dueño del Drive, el PDF fallará por permisos.');

  log('\n════════ FIN ════════');
  return L.join('\n');
}

// ============================================================
// Diagnóstico de UN registro concreto (solo lectura).
// Uso: cambiar REF y ejecutar. Reporta si el Doc origen aún existe.
// ============================================================
function diagnosticoRegistro() {
  var REF = 'REG-PR-DH-24_700';   // ← cambiar por la referencia a revisar

  var reg = getRegistro(REF);
  if (!reg.ok) { Logger.log('❌ ' + reg.error); return; }

  Logger.log('REF: ' + reg.ref + ' | fila: ' + reg.fila);
  Logger.log('Almacén: ' + reg.autAlm + ' | Calidad: ' + reg.autCal + ' | Supervisor: ' + reg.autSup);
  Logger.log('DOC_ID en hoja: ' + (reg.docId || '(vacío)'));

  if (!reg.docId) {
    Logger.log('⚠️ Sin DOC_ID: generarPDF() usará el fallback por nombre en PENDIENTES.');
  } else {
    try {
      var f = DriveApp.getFileById(reg.docId);
      Logger.log('Doc: "' + f.getName() + '" | mime: ' + f.getMimeType()
                 + ' | en papelera: ' + f.isTrashed());
      if (f.isTrashed()) {
        Logger.log('❌ El Doc origen está en PAPELERA → el reproceso no lo encontrará (Causa #2).');
      }
    } catch (e) {
      Logger.log('❌ DOC_ID inaccesible: ' + e.message);
    }
  }

  // ¿Existe ya el PDF en APROBADOS?
  try {
    var it = DriveApp.getFolderById(CFG.APRO_ID)
                     .getFilesByName(REF + '_DetectorMetales.pdf');
    Logger.log(it.hasNext() ? '✅ PDF ya existe en APROBADOS.' : '⚠️ No hay PDF en APROBADOS.');
  } catch (e) {
    Logger.log('❌ No se pudo revisar APROBADOS: ' + e.message);
  }
}
