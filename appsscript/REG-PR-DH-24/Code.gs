// ============================================================
// SISTEMA DETECTOR DE METALES — PLANTA DESHIDRATADOS
// Industrial de Alimentos
// ============================================================

var CFG = {
  SS_ID:          '1Pp7IafTSafonm1-8lT_aOD1nFETG06u7U7w0kvjzZbk',
  COD_SS_ID:      '1oytrmPddUCHQ6yzCeNfwuxCYqU399sW56ZQlKdIGuro',
  TEMPLATE_ID:    '1Wvs7XdOi6G8Z6NWG1n3nSva07qwjYn3Jsjxm3AiMgMY',
  PEND_ID:        '1xrz-Y92z2aNhdfQK9F0ynAvUbS9bqJQx',
  RECH_ID:        '1bcuVOthLcZ7p0GGIb0WZ9jed-kzxWdBl',
  APRO_ID:        '1RR1nz191yjSS4KeEO1QKzdXjJsIqaTZr',
  MATRIZ_ID:      '1M2SW3o4nhTJF7xBumKPQ0ltllQu_1n8FUWbp0UILiyY',
  PERSONAL_SS_ID: '1y9nelheSLAKk-foWLJACQwxKTGwI12l4uly3W7PmIBQ',
  EMAIL_ALM_PT:     'lcruz@industrialdealimentos.com',
  EMAIL_ALM_MP:     'ccarranza@industrialdealimentos.com',
  EMAIL_CALIDAD:    'lzelaya@industrialdealimentos.com',
  EMAIL_SUPERVISOR: 'ycruz@industrialdealimentos.com,emoncada@industrialdealimentos.com'
};

// ── CAMBIO 1: DOC_ID:28 agregado al final ──
var COL = {
  FECHA:0, REF:1, TURNO:2, ELABORADO:3, DESC:4, LOTE:5, PRESENTA:6,
  CANTIDAD:7, ST_CANT:8, FALLO1:9, FALLO2:10, LOTES_DEV:11, PPNI:12,
  AUT_ALM:13, EST_ALM:14, AUT_SUP:15, EST_SUP:16, AUT_CAL:17,
  TIEMPO_MIN:18, LINK_PDF:19, INSP_CAL:20, FECHA_CAL:21, TIEMPO_APR:22,
  CODIGO:23, BODEGA:24, HORA:25, TIMESTAMP:26, DESTINO:27,
  DOC_ID:28
};

// Último motivo de fallo de generarPDF(). Se muestra en el correo al supervisor
// para no depender del log de ejecuciones.
var ULTIMO_ERROR_PDF = '';

// ============================================================
// HELPER: convertir cualquier valor de celda a string seguro
// ============================================================
function cellToStr(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  return String(v).trim();
}

// ============================================================
// PÁGINAS
// ============================================================
function doGet(e) {
  var page = e.parameter.page || 'Operario';
  var ref  = e.parameter.ref  || '';
  var acc  = e.parameter.acc  || '';

  if (page === 'supervisor') return handleSupervisor(ref, acc);

  if (page === 'Calidad' || page === 'Almacen') {
    var tpl = HtmlService.createTemplateFromFile(page);
    tpl.ref = ref;
    return tpl.evaluate()
      .setTitle('Detector de Metales — ' + page)
      .addMetaTag('viewport', 'width=device-width,initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutputFromFile('Operario')
    .setTitle('Verificación Detector de Metales')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
// OBTENER PRODUCTOS
// ============================================================
function getProductos() {
  try {
    var ss  = SpreadsheetApp.openById(CFG.COD_SS_ID);
    var res = [];

    var hojaCod = ss.getSheetByName('Codigos');
    if (hojaCod) {
      var last = hojaCod.getLastRow();
      if (last >= 2) {
        var datos = hojaCod.getRange(2, 1, last - 1, 3).getValues();
        for (var i = 0; i < datos.length; i++) {
          var cod  = cellToStr(datos[i][0]);
          var desc = cellToStr(datos[i][1]);
          var pres = cellToStr(datos[i][2]);
          if (cod) res.push({ codigo: cod, descripcion: desc, presentacion: pres, origen: 'Codigos' });
        }
      }
    }

    var hojaDet = ss.getSheetByName('Detector');
    if (hojaDet) {
      var lastD  = hojaDet.getLastRow();
      if (lastD >= 2) {
        var datosD = hojaDet.getRange(2, 1, lastD - 1, 3).getValues();
        for (var j = 0; j < datosD.length; j++) {
          var codD  = cellToStr(datosD[j][0]);
          var descD = cellToStr(datosD[j][1]);
          var presD = cellToStr(datosD[j][2]);
          if (codD) res.push({ codigo: codD, descripcion: descD, presentacion: presD, origen: 'Detector' });
        }
      }
    }

    var hojaPruebas = ss.getSheetByName('Pruebas Indus');
    if (hojaPruebas) {
      var lastP  = hojaPruebas.getLastRow();
      if (lastP >= 2) {
        var datosP = hojaPruebas.getRange(2, 1, lastP - 1, 3).getValues();
        for (var k = 0; k < datosP.length; k++) {
          var codP  = cellToStr(datosP[k][0]);
          var descP = cellToStr(datosP[k][1]);
          var presP = cellToStr(datosP[k][2]);
          if (codP) res.push({ codigo: codP, descripcion: descP, presentacion: presP, origen: 'Pruebas Indus' });
        }
      }
    }

    return res;
  } catch (e) {
    Logger.log('ERROR getProductos: ' + e.message);
    return [];
  }
}

// ============================================================
// OBTENER ST PARA UN PT
// ============================================================
function getSTparaPT(codigoPT) {
  try {
    var ss   = SpreadsheetApp.openById(CFG.COD_SS_ID);
    var hoja = ss.getSheetByName('Codigos');
    if (!hoja) return null;
    var last = hoja.getLastRow();
    if (last < 2) return null;
    var datos = hoja.getRange(2, 1, last - 1, 5).getValues();
    for (var i = 0; i < datos.length; i++) {
      var cod = cellToStr(datos[i][0]).toUpperCase();
      if (cod !== codigoPT.toString().toUpperCase()) continue;
      var stCod  = cellToStr(datos[i][3]);
      var stDesc = cellToStr(datos[i][4]);
      if (stCod) return { codigo: stCod, descripcion: stDesc, presentacion: '' };
      return null;
    }
    return null;
  } catch (e) {
    Logger.log('ERROR getSTparaPT: ' + e.message);
    return null;
  }
}

// ============================================================
// OBTENER PERSONAL
// ============================================================
function getPersonal() {
  try {
    var ss    = SpreadsheetApp.openById(CFG.PERSONAL_SS_ID);
    var hoja  = null;
    var hojas = ss.getSheets();
    for (var i = 0; i < hojas.length; i++) {
      if (hojas[i].getName().toLowerCase().trim() === 'personal dh') {
        hoja = hojas[i]; break;
      }
    }
    if (!hoja) hoja = ss.getSheets()[0];
    if (!hoja) return [];
    var last  = hoja.getLastRow();
    if (last < 1) return [];
    var datos   = hoja.getRange(1, 1, last, 1).getValues();
    var nombres = [];
    for (var r = 0; r < datos.length; r++) {
      var n = cellToStr(datos[r][0]);
      if (n) nombres.push(n);
    }
    nombres.sort(function(a, b) { return a.localeCompare(b, 'es'); });
    return nombres;
  } catch (e) {
    Logger.log('ERROR getPersonal: ' + e.message);
    return [];
  }
}

// ============================================================
// GUARDAR REGISTRO — OPERARIO
// ============================================================
function submitOperario(datos) {
  try {
    var ss   = SpreadsheetApp.openById(CFG.SS_ID);
    var hoja = ss.getSheetByName('Detalle');
    if (!hoja) throw new Error('No se encontró hoja Detalle');

    datos.elaborado  = datos.elaborado_por      || datos.elaborado  || '';
    datos.cantidad   = datos.cantidad_entregada || datos.cantidad   || '';
    datos.stCantidad = datos.kilogramos_st      || datos.stCantidad || 0;
    datos.marcador1  = datos.marcador1 || 'NO';
    datos.marcador2  = (datos.marcador1 === 'SI') ? (datos.marcador2 || 'NO') : '';
    datos.ppni       = datos.autorizado_calidad ? 'SI' : 'NO';
    var destino      = datos.destino || 'ALMACEN';

    var now   = new Date();
    var tz    = Session.getScriptTimeZone();
    var fecha = Utilities.formatDate(now, tz, 'dd/MM/yyyy');
    var hora  = Utilities.formatDate(now, tz, 'HH:mm:ss');
    var ref   = generarRef();

    var fila = new Array(28).fill('');
    fila[COL.FECHA]      = fecha;
    fila[COL.REF]        = ref;
    fila[COL.TURNO]      = datos.turno        || '';
    fila[COL.ELABORADO]  = datos.elaborado;
    fila[COL.DESC]       = datos.descripcion  || '';
    fila[COL.LOTE]       = datos.lote         || '';
    fila[COL.PRESENTA]   = String(datos.presentacion || '');
    fila[COL.CANTIDAD]   = datos.cantidad;
    fila[COL.ST_CANT]    = datos.stCantidad;
    fila[COL.FALLO1]     = datos.marcador1;
    fila[COL.FALLO2]     = datos.marcador2;
    fila[COL.LOTES_DEV]  = datos.codigo_st    || '';
    fila[COL.PPNI]       = datos.ppni;

    if (destino === 'CALIDAD') {
      fila[COL.AUT_CAL] = 'PENDIENTE';
      fila[COL.AUT_ALM] = 'ESPERANDO_CALIDAD';
    } else {
      fila[COL.AUT_ALM] = 'PENDIENTE';
      fila[COL.AUT_CAL] = 'N/A';
    }

    fila[COL.EST_ALM]    = '';
    fila[COL.AUT_SUP]    = 'PENDIENTE';
    fila[COL.EST_SUP]    = '';
    fila[COL.TIEMPO_MIN] = '';
    fila[COL.LINK_PDF]   = '';
    fila[COL.INSP_CAL]   = '';
    fila[COL.FECHA_CAL]  = '';
    fila[COL.TIEMPO_APR] = '';
    fila[COL.CODIGO]     = datos.codigo  || '';
    fila[COL.BODEGA]     = datos.bodega  || '';
    fila[COL.HORA]       = hora;
    fila[COL.TIMESTAMP]  = now;
    fila[COL.DESTINO]    = destino;

    hoja.appendRow(fila);

    // ── CAMBIO 2: guardar DOC_ID en la hoja ──
    var docId = crearDocumento(ref, datos, fecha, hora);
    if (docId) {
      // Localizar la fila por REF en lugar de getLastRow(): con dos operarios
      // enviando a la vez, getLastRow() puede apuntar a la fila del otro.
      var regNuevo = getRegistro(ref);
      var filaDoc  = regNuevo.ok ? regNuevo.fila : hoja.getLastRow();
      hoja.getRange(filaDoc, COL.DOC_ID + 1).setValue(docId);
    }

    var webUrl       = ScriptApp.getService().getUrl();
    var emailAlmacen = getEmailDestino(datos.bodega);

    if (destino === 'CALIDAD') {
      enviarEmailCalidad(ref, datos, webUrl);
    } else {
      enviarEmailAlmacen(ref, datos, emailAlmacen, webUrl);
    }

    return { ok: true, success: true, ref: ref, referencia: ref };
  } catch (e) {
    Logger.log('ERROR submitOperario: ' + e.message);
    return { ok: false, success: false, error: e.message };
  }
}

// ============================================================
// LEER REGISTRO
// ============================================================
function getRegistro(ref) {
  try {
    var ss   = SpreadsheetApp.openById(CFG.SS_ID);
    var hoja = ss.getSheetByName('Detalle');
    if (!hoja) throw new Error('Hoja Detalle no encontrada');
    var tz    = Session.getScriptTimeZone();
    var datos = hoja.getDataRange().getValues();

    for (var i = 0; i < datos.length; i++) {
      if (String(datos[i][COL.REF]).trim() !== String(ref).trim()) continue;
      var fv = datos[i][COL.FECHA];
      var hv = datos[i][COL.HORA];
      return {
        ok:           true,
        ref:          cellToStr(datos[i][COL.REF]),
        fecha:        fv instanceof Date ? Utilities.formatDate(fv, tz, 'dd/MM/yyyy') : cellToStr(fv),
        hora:         hv instanceof Date ? Utilities.formatDate(hv, tz, 'HH:mm:ss')  : cellToStr(hv),
        turno:        cellToStr(datos[i][COL.TURNO]),
        elaborado:    cellToStr(datos[i][COL.ELABORADO]),
        codigo:       cellToStr(datos[i][COL.CODIGO]),
        descripcion:  cellToStr(datos[i][COL.DESC]),
        lote:         cellToStr(datos[i][COL.LOTE]),
        presentacion: cellToStr(datos[i][COL.PRESENTA]),
        cantidad:     cellToStr(datos[i][COL.CANTIDAD]),
        stCantidad:   cellToStr(datos[i][COL.ST_CANT]),
        codigo_st:    cellToStr(datos[i][COL.LOTES_DEV]),
        bodega:       cellToStr(datos[i][COL.BODEGA]),
        fallo1:       cellToStr(datos[i][COL.FALLO1]),
        fallo2:       cellToStr(datos[i][COL.FALLO2]),
        ppni:         cellToStr(datos[i][COL.PPNI]),
        autAlm:       cellToStr(datos[i][COL.AUT_ALM]),
        autCal:       cellToStr(datos[i][COL.AUT_CAL]),
        autSup:       cellToStr(datos[i][COL.AUT_SUP]),
        destino:      cellToStr(datos[i][COL.DESTINO]),
        docId:        datos[i].length > COL.DOC_ID ? cellToStr(datos[i][COL.DOC_ID]) : '',
        fila:         i + 1
      };
    }
    return { ok: false, error: 'Referencia no encontrada: ' + ref };
  } catch (e) {
    Logger.log('ERROR getRegistro: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// APROBACIÓN CALIDAD
// ============================================================
function aprobarCalidad(ref, inspector, decision) {
  try {
    var ss   = SpreadsheetApp.openById(CFG.SS_ID);
    var hoja = ss.getSheetByName('Detalle');
    var reg  = getRegistro(ref);
    if (!reg.ok) return { ok: false, error: reg.error };

    var estado   = decision === 'APROBADO' ? 'APROBADO' : 'RECHAZADO';
    var fechaCal = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');

    hoja.getRange(reg.fila, COL.AUT_CAL   + 1).setValue(estado);
    hoja.getRange(reg.fila, COL.INSP_CAL  + 1).setValue(inspector);
    hoja.getRange(reg.fila, COL.FECHA_CAL + 1).setValue(fechaCal);

    if (decision === 'APROBADO') {
      hoja.getRange(reg.fila, COL.AUT_ALM + 1).setValue('PENDIENTE');
      var regAct   = getRegistro(ref);
      var webUrl   = ScriptApp.getService().getUrl();
      var emailAlm = getEmailDestino(regAct.bodega);
      var datosAlm = {
        descripcion: regAct.descripcion, codigo: regAct.codigo,
        lote: regAct.lote, presentacion: regAct.presentacion,
        cantidad: regAct.cantidad, stCantidad: regAct.stCantidad,
        bodega: regAct.bodega, elaborado: regAct.elaborado
      };
      enviarEmailAlmacenPostCalidad(ref, datosAlm, emailAlm, webUrl, inspector);
    } else {
      hoja.getRange(reg.fila, COL.AUT_ALM + 1).setValue('CANCELADO_POR_CALIDAD');
      moverDocumento(ref, CFG.RECH_ID);
    }

    return { ok: true };
  } catch (e) {
    Logger.log('ERROR aprobarCalidad: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// APROBACIÓN ALMACÉN
// ============================================================
function aprobarAlmacen(ref, responsable, decision, observacion) {
  try {
    var ss   = SpreadsheetApp.openById(CFG.SS_ID);
    var hoja = ss.getSheetByName('Detalle');
    var reg  = getRegistro(ref);
    if (!reg.ok) return { ok: false, error: reg.error };

    var estado = decision === 'aprobar' ? 'APROBADO' : 'RECHAZADO';
    hoja.getRange(reg.fila, COL.AUT_ALM + 1).setValue(estado);

    var tz       = Session.getScriptTimeZone();
    var horaAuto = Utilities.formatDate(new Date(), tz, 'HH:mm');
    hoja.getRange(reg.fila, COL.EST_ALM + 1).setValue(responsable + ' (' + horaAuto + ')');

    if (observacion && observacion.trim() !== '') {
      hoja.getRange(reg.fila, 8).setValue(observacion.trim());
    }

    verificarAprobacionFinal(ref, reg.fila, hoja);
    return { ok: true };
  } catch (e) {
    Logger.log('ERROR aprobarAlmacen: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// GUARDAR EN MATRIZ PT / ST / MP
// ============================================================
function guardarEnMatriz(reg, pdfLink) {
  try {
    var ss         = SpreadsheetApp.openById(CFG.MATRIZ_ID);
    var codigoStr  = String(reg.codigo || '').toUpperCase().trim();
    var nombreHoja = codigoStr.indexOf('MP') === 0 ? 'Detalle de MP' : 'Detalle de PT';
    var hojaPrin   = ss.getSheetByName(nombreHoja);
    if (hojaPrin) {
      hojaPrin.appendRow([
        reg.fecha || '', reg.codigo || '', reg.descripcion || '',
        reg.cantidad || '', reg.lote || '', reg.presentacion || '', reg.bodega || '',
        pdfLink || ''
      ]);
    }
    var kgST = parseFloat(reg.stCantidad);
    if (!isNaN(kgST) && kgST > 0) {
      var hojaST = ss.getSheetByName('Detalle de ST');
      if (hojaST) {
        hojaST.appendRow([
          reg.fecha || '', reg.codigo_st || 'ST-Generado',
          'ST derivado de ' + reg.descripcion, kgST + ' KG',
          reg.lote || '', 'A granel', reg.bodega || '',
          pdfLink || ''
        ]);
      }
    }
  } catch (e) {
    Logger.log('ERROR guardarEnMatriz: ' + e.message);
  }
}

// ============================================================
// VERIFICAR APROBACIÓN FINAL → NOTIFICAR SUPERVISOR
// ============================================================
function verificarAprobacionFinal(ref, fila, hoja) {
  var datos   = hoja.getRange(fila, 1, 1, 28).getValues()[0];
  var estAlm  = cellToStr(datos[COL.AUT_ALM]);
  var estCal  = cellToStr(datos[COL.AUT_CAL]);
  var linkPdf = cellToStr(datos[COL.LINK_PDF]);

  if (estAlm === 'APROBADO' && (estCal === 'APROBADO' || estCal === 'N/A')) {
    if (linkPdf === '') {
      notificarSupervisor(ref, datos, fila, hoja);
    } else {
      Logger.log('⚠️ Doble notificación bloqueada para: ' + ref);
    }
  }
}

// ============================================================
// GENERAR PDF — CAMBIO 3: busca por DOC_ID primero
// ============================================================
function generarPDF(ref, datos) {
  ULTIMO_ERROR_PDF = '';
  try {
    // ── CAMBIO 3: obtener docId desde la hoja, fallback por nombre ──
    var docId = '';
    var reg   = getRegistro(ref);
    if (reg.ok && reg.docId) {
      docId = reg.docId;
    }

    if (!docId) {
      Logger.log('⚠️ DOC_ID no encontrado en hoja, buscando por nombre: ' + ref);
      var carpPend = DriveApp.getFolderById(CFG.PEND_ID);
      var iter     = carpPend.getFilesByName(ref + ' — Verificación Detector Metales');
      if (iter.hasNext()) {
        docId = iter.next().getId();
      } else {
        var all = carpPend.getFiles();
        while (all.hasNext()) {
          var f = all.next();
          if (f.getName().indexOf(ref) !== -1
              && f.getMimeType() === MimeType.GOOGLE_DOCS) {
            docId = f.getId(); break;
          }
        }
      }
    }

    if (!docId) throw new Error('Documento no encontrado en PENDIENTES: ' + ref);

    var docFile = DriveApp.getFileById(docId);
    var doc     = DocumentApp.openById(docId);
    var body    = doc.getBody();

    body.replaceText('\\{\\{verificado_recibido\\}\\}', cellToStr(datos[COL.EST_ALM]) || 'N/A');

    var tz = Session.getScriptTimeZone();
    body.replaceText('\\{\\{fecha_recibido\\}\\}', Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss'));

    var estCal      = cellToStr(datos[COL.AUT_CAL]).toUpperCase();
    var insp        = cellToStr(datos[COL.INSP_CAL]);
    var authCalidad = 'N/A';
    if      (estCal === 'APROBADO'  && insp) authCalidad = insp;
    else if (estCal === 'RECHAZADO')         authCalidad = 'RECHAZADO';

    body.replaceText('\\{\\{autorizado_calidad\\}\\}',  authCalidad);
    body.replaceText('\\{\\{autorizado_calidadl\\}\\}', authCalidad);

    doc.saveAndClose();
    Utilities.sleep(4000);

    var pdfName   = ref + '_DetectorMetales.pdf';
    var token     = ScriptApp.getOAuthToken();
    var exportUrl = 'https://www.googleapis.com/drive/v3/files/' + docId
                  + '/export?mimeType=application%2Fpdf';

    // Reintentos: un 429/500 transitorio no debe costarnos el PDF.
    var response = null, code = 0;
    for (var intento = 1; intento <= 3; intento++) {
      response = UrlFetchApp.fetch(exportUrl, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
      });
      code = response.getResponseCode();
      if (code === 200) break;
      Logger.log('⚠️ Export intento ' + intento + ' → HTTP ' + code);
      if (intento < 3) Utilities.sleep(3000 * intento);
    }

    if (code !== 200) {
      throw new Error('Export falló HTTP ' + code + ' tras 3 intentos: ' + response.getContentText().substring(0, 300));
    }

    var pdfBytes   = response.getContent();
    var blobDrive  = Utilities.newBlob(pdfBytes, 'application/pdf', pdfName);
    var blobCorreo = Utilities.newBlob(pdfBytes, 'application/pdf', pdfName);

    var carpApro   = DriveApp.getFolderById(CFG.APRO_ID);
    var existentes = carpApro.getFilesByName(pdfName);
    while (existentes.hasNext()) existentes.next().setTrashed(true);

    var pdfFile = carpApro.createFile(blobDrive);

    // Mover el Doc origen a APROBADOS en vez de mandarlo a la papelera: así el
    // DOC_ID guardado en la hoja sigue siendo válido y los reprocesos funcionan
    // (los iteradores de Drive no listan archivos en papelera).
    try { docFile.moveTo(carpApro); } catch(e) { Logger.log('⚠️ No se pudo mover doc original: ' + e.message); }

    return { url: pdfFile.getUrl(), id: pdfFile.getId(), blob: blobCorreo };
  } catch (e) {
    ULTIMO_ERROR_PDF = e.message;
    Logger.log('ERROR generarPDF: ' + e.message + ' | ' + (e.stack || ''));
    return null;
  }
}

// ============================================================
// NOTIFICAR SUPERVISOR
// ============================================================
function notificarSupervisor(ref, datos, fila, hoja) {
  var tz       = Session.getScriptTimeZone();
  var fv       = datos[COL.FECHA];
  var hv       = datos[COL.HORA];
  var fechaStr = (fv instanceof Date) ? Utilities.formatDate(fv, tz, 'dd/MM/yyyy') : cellToStr(fv);
  var horaStr  = (hv instanceof Date) ? Utilities.formatDate(hv, tz, 'HH:mm:ss')   : cellToStr(hv);

  var pdf      = generarPDF(ref, datos);
  var pdfLink  = '';
  var adjuntos = [];

  if (pdf) {
    pdfLink = pdf.url;
    hoja.getRange(fila, COL.LINK_PDF + 1).setValue(pdfLink);
    try { adjuntos.push(pdf.blob); } catch(err) { Logger.log('Error adjunto PDF: ' + err.message); }
  } else {
    Logger.log('ADVERTENCIA: generarPDF retornó null para: ' + ref);
  }

  var regParaMatriz = getRegistro(ref);
  if (regParaMatriz.ok) guardarEnMatriz(regParaMatriz, pdfLink);

  var webUrl  = ScriptApp.getService().getUrl();
  var urlApro = webUrl + '?page=supervisor&ref=' + encodeURIComponent(ref) + '&acc=aprobar';
  var urlRech = webUrl + '?page=supervisor&ref=' + encodeURIComponent(ref) + '&acc=rechazar';

  var html = emailBase_cabecera()
    + '<h2 style="color:#1a56db;margin-top:0">Autorización Final Requerida</h2>'
    + '<p style="color:#475569">Las áreas correspondientes han aprobado. Requiere su autorización final.</p>'
    + '<table style="border-collapse:collapse;width:100%;margin:16px 0">'
    + f2c('Referencia',       ref)
    + f2c('Fecha / Hora',     fechaStr + ' ' + horaStr)
    + f2c('Turno',            cellToStr(datos[COL.TURNO]))
    + f2c('Elaborado por',    cellToStr(datos[COL.ELABORADO]))
    + f2c('Producto',         cellToStr(datos[COL.DESC]))
    + f2c('Código',           cellToStr(datos[COL.CODIGO]))
    + f2c('Lote',             cellToStr(datos[COL.LOTE]))
    + f2c('Presentación',     cellToStr(datos[COL.PRESENTA]))
    + f2c('Bodega',           cellToStr(datos[COL.BODEGA]))
    + f2c('Cantidad',         cellToStr(datos[COL.CANTIDAD]))
    + f2c('KG ST',            cellToStr(datos[COL.ST_CANT]))
    + f2c('Aprobado Calidad', cellToStr(datos[COL.AUT_CAL]) || 'N/A')
    + f2c('Aprobado Almacén', cellToStr(datos[COL.AUT_ALM]) || 'N/A')
    + '</table>'
    + (pdfLink
        ? '<p style="text-align:center;margin:15px 0"><a href="' + pdfLink + '" style="background:#0369a1;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:bold">📄 Ver PDF en Drive</a></p>'
        : '<p style="color:#dc2626;text-align:center">⚠️ PDF no disponible'
          + (ULTIMO_ERROR_PDF ? '<br><span style="font-size:12px;color:#991b1b">Motivo: ' + ULTIMO_ERROR_PDF + '</span>' : '')
          + '</p>')
    + '<div style="text-align:center;margin:28px 0">'
    + '<a href="' + urlApro + '" style="background:#16a34a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;margin-right:12px">✅ APROBAR</a>'
    + '<a href="' + urlRech + '" style="background:#dc2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold">❌ RECHAZAR</a>'
    + '</div>'
    + emailBase_pie();

  MailApp.sendEmail({
    to:          CFG.EMAIL_SUPERVISOR,
    subject:     ref + ' — Autorización Supervisor',
    htmlBody:    html,
    attachments: adjuntos
  });

  Logger.log('Email supervisor enviado | adjuntos: ' + adjuntos.length);
}

// ============================================================
// MANEJAR SUPERVISOR
// ============================================================
function handleSupervisor(ref, acc) {
  try {
    var ss   = SpreadsheetApp.openById(CFG.SS_ID);
    var hoja = ss.getSheetByName('Detalle');
    var reg  = getRegistro(ref);
    if (!reg.ok) return HtmlService.createHtmlOutput('<h2>Error: ' + reg.error + '</h2>');

    var now    = new Date();
    var tz     = Session.getScriptTimeZone();
    var estado = acc === 'aprobar' ? 'APROBADO' : 'RECHAZADO';
    var datos  = hoja.getRange(reg.fila, 1, 1, 28).getValues()[0];
    var ts     = datos[COL.TIMESTAMP];
    var mins   = ts ? Math.round((now - new Date(ts)) / 60000) : '';

    hoja.getRange(reg.fila, COL.AUT_SUP    + 1).setValue(estado);
    hoja.getRange(reg.fila, COL.EST_SUP    + 1).setValue(Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm'));
    hoja.getRange(reg.fila, COL.TIEMPO_MIN + 1).setValue(mins);

    var pdfLink = cellToStr(datos[COL.LINK_PDF]);
    if (acc === 'rechazar') moverDocumento(ref, CFG.RECH_ID);

    return HtmlService.createHtmlOutput(
      '<div style="font-family:Arial,sans-serif;text-align:center;padding:60px;background:#f8fafc;min-height:100vh">'
      + '<div style="max-width:440px;margin:auto;background:#fff;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.1)">'
      + '<p style="font-size:56px;margin:0">' + (acc === 'aprobar' ? '✅' : '❌') + '</p>'
      + '<h2 style="color:' + (acc === 'aprobar' ? '#16a34a' : '#dc2626') + ';margin:16px 0">'
      + (acc === 'aprobar' ? 'Registro AUTORIZADO' : 'Registro RECHAZADO') + '</h2>'
      + '<p style="color:#666">' + ref + '</p>'
      + (pdfLink ? '<p style="margin-top:20px"><a href="' + pdfLink + '" target="_blank" style="color:#0369a1;font-weight:bold">Ver PDF en Drive</a></p>' : '')
      + '</div></div>'
    );
  } catch (e) {
    Logger.log('ERROR handleSupervisor: ' + e.message);
    return HtmlService.createHtmlOutput('<h2>Error: ' + e.message + '</h2>');
  }
}

// ============================================================
// CREAR DOCUMENTO
// ============================================================
function crearDocumento(ref, datos, fecha, hora) {
  try {
    var copia = DriveApp.getFileById(CFG.TEMPLATE_ID).makeCopy(
      ref + ' — Verificación Detector Metales',
      DriveApp.getFolderById(CFG.PEND_ID)
    );
    var body = DocumentApp.openById(copia.getId()).getBody();
    var rr   = function(p, v) { body.replaceText(p, v || ' '); };

    rr('\\{\\{referencia\\}\\}',         ref);
    rr('\\{\\{fecha\\}\\}',              fecha);
    rr('\\{\\{hora\\}\\}',               hora);
    rr('\\{\\{recibido_por\\}\\}',       datos.elaborado_por || datos.elaborado || '');
    rr('\\{\\{codigo\\}\\}',             datos.codigo        || '');
    rr('\\{\\{descripcion\\}\\}',        datos.descripcion   || '');
    rr('\\{\\{lote\\}\\}',               datos.lote          || '');
    rr('\\{\\{presentacion\\}\\}',       String(datos.presentacion || ''));
    rr('\\{\\{cantidad_entregada\\}\\}', String(datos.cantidad || datos.cantidad_entregada || ''));

    var stKg = parseFloat(datos.stCantidad || datos.kilogramos_st);
    rr('\\{\\{kilogramos_st\\}\\}', (stKg && stKg > 0) ? stKg + ' KG' : 'N/A');

    rr('\\{\\{e1_obs\\}\\}',        datos.obs_cantidad || ' ');
    rr('\\{\\{e2_obs\\}\\}',        datos.obs_st       || ' ');
    rr('\\{\\{observaciones\\}\\}', datos.obs_testigos || ' ');
    rr('\\{\\{corre_desvi\\}\\}',   datos.correccion   || ' ');

    var fechaCompletaProduccion = (datos.fecha_entrega || fecha) + ' ' + hora;
    rr('\\{\\{Entregado_entrega\\}\\}', datos.entregado_por || datos.elaborado || '');
    rr('\\{\\{fecha_entrega\\}\\}',     fechaCompletaProduccion);

    rr('\\{\\{test_no_ferr_1\\.5\\}\\}', datos.t_noferr15 || '');
    rr('\\{\\{test_ferr_1\\.5\\}\\}',    datos.t_ferr15   || '');
    rr('\\{\\{test_acero_2\\.0\\}\\}',   datos.t_acero20  || '');
    rr('\\{\\{test_ferr_1\\.5b\\}\\}',   datos.t_ferr15b  || '');
    rr('\\{\\{test_ferro_2\\.0\\}\\}',   datos.t_ferro20  || '');
    rr('\\{\\{test_no_ferr_2\\.0\\}\\}', datos.t_noferr20 || '');
    rr('\\{\\{test_acer_2\\.5\\}\\}',    datos.t_acer25   || '');

    body.replaceText('\\{\\{si_de\\}\\}',   datos.marcador1 === 'SI' ? 'X' : ' ');
    body.replaceText('\\{\\{no_de\\}\\}',   datos.marcador1 === 'NO' ? 'X' : ' ');
    body.replaceText('\\{\\{si_des1\\}\\}', datos.marcador2 === 'SI' ? 'X' : ' ');
    body.replaceText('\\{\\{no_des1\\}\\}', datos.marcador2 === 'NO' ? 'X' : ' ');

    rr('\\{\\{autorizado_calidad\\}\\}',  'N/A');
    rr('\\{\\{autorizado_calidadl\\}\\}', 'N/A');

    DocumentApp.openById(copia.getId()).saveAndClose();
    return copia.getId();
  } catch (e) {
    Logger.log('ERROR crearDocumento: ' + e.message);
    return '';
  }
}

// ============================================================
// MOVER DOCUMENTO
// ============================================================
function moverDocumento(ref, carpetaId) {
  try {
    var dest     = DriveApp.getFolderById(carpetaId);
    var iterPend = DriveApp.getFolderById(CFG.PEND_ID).getFiles();
    while (iterPend.hasNext()) {
      var f1 = iterPend.next();
      if (f1.getName().indexOf(ref) !== -1) f1.moveTo(dest);
    }
    var iterApro = DriveApp.getFolderById(CFG.APRO_ID).getFiles();
    while (iterApro.hasNext()) {
      var f2 = iterApro.next();
      if (f2.getName().indexOf(ref) !== -1) f2.moveTo(dest);
    }
  } catch (e) { Logger.log('ERROR moverDocumento: ' + e.message); }
}

// ============================================================
// EMAILS DE FLUJO
// ============================================================
function enviarEmailAlmacen(ref, datos, destino, webUrl) {
  var url  = webUrl + '?page=Almacen&ref=' + encodeURIComponent(ref);
  var html = emailBase_cabecera()
    + '<h2 style="color:#0f172a;margin-top:0">Verificación pendiente — Almacén</h2>'
    + '<p style="color:#475569">Se requiere su verificación de cantidades para el siguiente registro.</p>'
    + tablaProducto(ref, datos)
    + '<div style="text-align:center;margin:28px 0">'
    + '<a href="' + url + '" style="background:#1565C0;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">VERIFICAR EN ALMACÉN</a>'
    + '</div>' + emailBase_pie();
  MailApp.sendEmail({ to: destino, subject: ref + ' — Verificación Almacén', htmlBody: html });
}

function enviarEmailAlmacenPostCalidad(ref, datos, destino, webUrl, inspectorCalidad) {
  var url  = webUrl + '?page=Almacen&ref=' + encodeURIComponent(ref);
  var html = emailBase_cabecera()
    + '<h2 style="color:#0f172a;margin-top:0">Producto Liberado por Calidad — Verificar en Almacén</h2>'
    + '<div style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:8px;padding:12px 16px;margin:14px 0">'
    + '<p style="margin:0;color:#1B5E20;font-weight:600">Calidad aprobó este registro</p>'
    + '<p style="margin:6px 0 0;color:#475569;font-size:13px">Inspector: <b>' + (inspectorCalidad || '—') + '</b></p>'
    + '</div>'
    + '<p style="color:#475569">El producto fue liberado por Calidad. Se requiere su verificación en Almacén.</p>'
    + tablaProducto(ref, datos)
    + '<div style="text-align:center;margin:28px 0">'
    + '<a href="' + url + '" style="background:#1565C0;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">VERIFICAR EN ALMACÉN</a>'
    + '</div>' + emailBase_pie();
  MailApp.sendEmail({ to: destino, subject: ref + ' — Liberado por Calidad — Verificar Almacén', htmlBody: html });
}

function enviarEmailCalidad(ref, datos, webUrl) {
  var url  = webUrl + '?page=Calidad&ref=' + encodeURIComponent(ref);
  var html = emailBase_cabecera()
    + '<h2 style="color:#0f172a;margin-top:0">Verificación — Inspector de Calidad</h2>'
    + '<p style="color:#475569">El detector marcó producto. Se requiere revisión de Inspector de Calidad <b>antes</b> de pasar a Almacén.</p>'
    + tablaProducto(ref, datos)
    + '<div style="text-align:center;margin:28px 0">'
    + '<a href="' + url + '" style="background:#7c3aed;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">REVISAR COMO INSPECTOR</a>'
    + '</div>' + emailBase_pie();
  MailApp.sendEmail({ to: CFG.EMAIL_CALIDAD, subject: ref + ' — Marca en Detector de Metales', htmlBody: html });
}

// ============================================================
// HELPERS
// ============================================================
function getEmailDestino(bodega) {
  return (bodega || '').indexOf('AG03') !== -1 ? CFG.EMAIL_ALM_MP : CFG.EMAIL_ALM_PT;
}

function generarRef() {
  try {
    var hoja      = SpreadsheetApp.openById(CFG.SS_ID).getSheetByName('Detalle');
    var lastRow   = hoja.getLastRow();
    var siguiente = Math.max(1, lastRow);
    return 'REG-PR-DH-24_' + siguiente;
  } catch (e) {
    Logger.log('ERROR generarRef: ' + e.message);
    var now = new Date(), tz = Session.getScriptTimeZone();
    return 'REG-PR-DH-24_' + Utilities.formatDate(now, tz, 'yyyyMMddHHmmss');
  }
}

function tablaProducto(ref, datos) {
  return '<table style="border-collapse:collapse;width:100%;margin:16px 0">'
    + f2c('Referencia',    ref)
    + f2c('Producto',      datos.descripcion  || '')
    + f2c('Código',        datos.codigo       || '')
    + f2c('Lote',          datos.lote         || '')
    + f2c('Presentación',  datos.presentacion || '')
    + f2c('Cantidad',      datos.cantidad     || '')
    + f2c('KG ST',         datos.stCantidad   ? datos.stCantidad + ' KG' : 'N/A')
    + f2c('Bodega',        datos.bodega       || '')
    + f2c('Elaborado por', datos.elaborado    || '')
    + '</table>';
}

function emailBase_cabecera() {
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">'
    + '<div style="background:#0f172a;padding:18px 24px">'
    + '<span style="color:#fff;font-size:17px;font-weight:bold">Industrial de Alimentos — Planta Deshidratados</span>'
    + '</div><div style="padding:24px">';
}

function emailBase_pie() {
  return '<p style="font-size:11px;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:14px;margin-top:20px">'
    + 'Sistema Detector de Metales — REG-PR-DH-24</p></div></div>';
}

function f2c(label, valor) {
  return '<tr>'
    + '<td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;width:38%">' + label + '</td>'
    + '<td style="padding:8px 12px;border:1px solid #e2e8f0">' + valor + '</td>'
    + '</tr>';
}

// ============================================================
// REPROCESAR REGISTROS ATASCADOS (USO MANUAL DESDE EDITOR)
// ============================================================
function reprocesarTodosAtascados() {
  var ss   = SpreadsheetApp.openById(CFG.SS_ID);
  var hoja = ss.getSheetByName('Detalle');

  var refs = [
    'REG-PR-DH-24_38',  'REG-PR-DH-24_508', 'REG-PR-DH-24_686',
    'REG-PR-DH-24_687', 'REG-PR-DH-24_688', 'REG-PR-DH-24_689',
    'REG-PR-DH-24_690', 'REG-PR-DH-24_691', 'REG-PR-DH-24_692',
    'REG-PR-DH-24_693', 'REG-PR-DH-24_694', 'REG-PR-DH-24_695',
    'REG-PR-DH-24_696', 'REG-PR-DH-24_697', 'REG-PR-DH-24_698',
    'REG-PR-DH-24_699'
  ];

  var ok = 0, fail = 0;

  for (var i = 0; i < refs.length; i++) {
    var ref = refs[i];
    try {
      Logger.log('─── Procesando: ' + ref);
      var reg = getRegistro(ref);
      if (!reg.ok) { Logger.log('❌ No encontrado: ' + ref); fail++; continue; }

      var filaData = hoja.getRange(reg.fila, 1, 1, 28).getValues()[0];
      hoja.getRange(reg.fila, COL.LINK_PDF + 1).setValue('');

      notificarSupervisor(ref, filaData, reg.fila, hoja);
      Logger.log('✅ OK: ' + ref);
      ok++;

      Utilities.sleep(3000);
    } catch(e) {
      Logger.log('❌ Error en ' + ref + ': ' + e.message);
      fail++;
    }
  }

  Logger.log('════════════════════════════════');
  Logger.log('✅ OK: ' + ok + ' | ❌ Fallidos: ' + fail);
}

function reprocesarRegistroSinPDF(ref) {
  var ss   = SpreadsheetApp.openById(CFG.SS_ID);
  var hoja = ss.getSheetByName('Detalle');
  var reg  = getRegistro(ref);
  if (!reg.ok) { Logger.log('❌ Registro no encontrado: ' + ref); return; }

  var datos  = hoja.getRange(reg.fila, 1, 1, 28).getValues()[0];
  var estAlm = cellToStr(datos[COL.AUT_ALM]);
  var estCal = cellToStr(datos[COL.AUT_CAL]);

  if (estAlm !== 'APROBADO') { Logger.log('❌ Almacén no está APROBADO'); return; }
  if (estCal !== 'APROBADO' && estCal !== 'N/A') { Logger.log('❌ Calidad no está APROBADO/N/A'); return; }

  hoja.getRange(reg.fila, COL.LINK_PDF + 1).setValue('');
  notificarSupervisor(ref, datos, reg.fila, hoja);
  Logger.log('✅ Reprocesado: ' + ref);
}

function runReprocesar() {
  reprocesarRegistroSinPDF('REG-PR-DH-24_700');
}

// ============================================================
// PRUEBA — envía el flujo completo solo a ctorres@
// ============================================================
function pruebaPDF() {
  var EMAIL_PRUEBA = 'ctorres@industrialdealimentos.com';
  Logger.log('🧪 INICIO PRUEBA → ' + EMAIL_PRUEBA);

  try {
    var ss   = SpreadsheetApp.openById(CFG.SS_ID);
    var hoja = ss.getSheetByName('Detalle');
    if (!hoja) throw new Error('No se encontró hoja Detalle');

    var now   = new Date();
    var tz    = Session.getScriptTimeZone();
    var fecha = Utilities.formatDate(now, tz, 'dd/MM/yyyy');
    var hora  = Utilities.formatDate(now, tz, 'HH:mm:ss');
    var ref   = 'PRUEBA_' + Utilities.formatDate(now, tz, 'yyyyMMdd_HHmmss');

    var datosPrueba = {
      elaborado: 'SAMUEL TORRES (PRUEBA)', elaborado_por: 'SAMUEL TORRES (PRUEBA)',
      turno: 'DIURNO', codigo: 'PT-TEST-001',
      descripcion: 'PRODUCTO DE PRUEBA — DETECTOR METALES',
      lote: 'LOTE-TEST-' + Utilities.formatDate(now, tz, 'yyyyMMdd'),
      presentacion: '25 KG', cantidad: '100 KG', cantidad_entregada: '100 KG',
      stCantidad: 5, kilogramos_st: 5, codigo_st: 'ST-TEST-001',
      bodega: 'AG01 - Almacén PT', marcador1: 'NO', marcador2: '',
      t_noferr15: 'OK', t_ferr15: 'OK', t_acero20: 'OK',
      t_ferr15b:  'OK', t_ferro20: 'OK', t_noferr20: 'OK', t_acer25: 'OK',
      obs_cantidad: 'Sin novedad', obs_st: 'Sin novedad ST',
      obs_testigos: 'Prueba de sistema', correccion: 'N/A'
    };

    // Crear fila en la hoja
    var fila = new Array(28).fill('');
    fila[COL.FECHA]     = fecha;   fila[COL.REF]       = ref;
    fila[COL.TURNO]     = datosPrueba.turno;
    fila[COL.ELABORADO] = datosPrueba.elaborado;
    fila[COL.DESC]      = datosPrueba.descripcion;
    fila[COL.LOTE]      = datosPrueba.lote;
    fila[COL.PRESENTA]  = datosPrueba.presentacion;
    fila[COL.CANTIDAD]  = datosPrueba.cantidad;
    fila[COL.ST_CANT]   = datosPrueba.stCantidad;
    fila[COL.FALLO1]    = 'NO';   fila[COL.FALLO2]    = '';
    fila[COL.LOTES_DEV] = datosPrueba.codigo_st;
    fila[COL.PPNI]      = 'NO';   fila[COL.AUT_ALM]   = 'APROBADO';
    fila[COL.EST_ALM]   = 'PRUEBA-ALMACEN';
    fila[COL.AUT_SUP]   = 'PENDIENTE'; fila[COL.AUT_CAL] = 'N/A';
    fila[COL.LINK_PDF]  = '';
    fila[COL.CODIGO]    = datosPrueba.codigo;
    fila[COL.BODEGA]    = datosPrueba.bodega;
    fila[COL.HORA]      = hora;
    fila[COL.TIMESTAMP] = now;    fila[COL.DESTINO]   = 'ALMACEN';

    hoja.appendRow(fila);
    var filaNum = hoja.getLastRow();

    // Crear documento y guardar DOC_ID
    var docId = crearDocumento(ref, datosPrueba, fecha, hora);
    if (!docId) throw new Error('crearDocumento() retornó vacío');
    hoja.getRange(filaNum, COL.DOC_ID + 1).setValue(docId);
    Logger.log('✅ Documento creado: ' + docId);

    // Leer fila actualizada y generar PDF
    var filaData = hoja.getRange(filaNum, 1, 1, 28).getValues()[0];
    var pdf = generarPDF(ref, filaData);
    if (!pdf) throw new Error('generarPDF() retornó null');

    hoja.getRange(filaNum, COL.LINK_PDF + 1).setValue(pdf.url);
    Logger.log('✅ PDF generado: ' + pdf.url);

    // Guardar en Matriz
    var regMat = getRegistro(ref);
    if (regMat.ok) guardarEnMatriz(regMat, pdf.url);

    // Armar email SOLO a ctorres@
    var webUrl  = ScriptApp.getService().getUrl();
    var urlApro = webUrl + '?page=supervisor&ref=' + encodeURIComponent(ref) + '&acc=aprobar';
    var urlRech = webUrl + '?page=supervisor&ref=' + encodeURIComponent(ref) + '&acc=rechazar';

    var html = emailBase_cabecera()
      + '<div style="background:#FFF3CD;border:1px solid #FFC107;border-radius:8px;padding:10px 16px;margin-bottom:16px">'
      + '<b style="color:#856404">🧪 CORREO DE PRUEBA — va a ctorres@, en producción va a ycruz@</b>'
      + '</div>'
      + '<h2 style="color:#1a56db;margin-top:0">Autorización Final Requerida</h2>'
      + '<p style="color:#475569">Las áreas correspondientes han aprobado. Requiere su autorización final.</p>'
      + '<table style="border-collapse:collapse;width:100%;margin:16px 0">'
      + f2c('Referencia',       ref)
      + f2c('Fecha / Hora',     fecha + ' ' + hora)
      + f2c('Turno',            datosPrueba.turno)
      + f2c('Elaborado por',    datosPrueba.elaborado)
      + f2c('Producto',         datosPrueba.descripcion)
      + f2c('Código',           datosPrueba.codigo)
      + f2c('Lote',             datosPrueba.lote)
      + f2c('Presentación',     datosPrueba.presentacion)
      + f2c('Bodega',           datosPrueba.bodega)
      + f2c('Cantidad',         datosPrueba.cantidad)
      + f2c('KG ST',            datosPrueba.stCantidad + ' KG')
      + f2c('Aprobado Calidad', 'N/A')
      + f2c('Aprobado Almacén', 'APROBADO')
      + '</table>'
      + '<p style="text-align:center;margin:15px 0"><a href="' + pdf.url + '" style="background:#0369a1;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:bold">📄 Ver PDF en Drive</a></p>'
      + '<div style="text-align:center;margin:28px 0">'
      + '<a href="' + urlApro + '" style="background:#16a34a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;margin-right:12px">✅ APROBAR</a>'
      + '<a href="' + urlRech + '" style="background:#dc2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold">❌ RECHAZAR</a>'
      + '</div>'
      + emailBase_pie();

    var adjuntos = [];
    try { if (pdf.blob) adjuntos.push(pdf.blob); } catch(e2) {}

    MailApp.sendEmail({
      to:          EMAIL_PRUEBA,
      subject:     '[PRUEBA] ' + ref + ' — Autorización Supervisor',
      htmlBody:    html,
      attachments: adjuntos
    });

    Logger.log('🎉 PRUEBA EXITOSA | REF: ' + ref + ' | Email: ' + EMAIL_PRUEBA);

  } catch (e) {
    Logger.log('❌ PRUEBA FALLÓ: ' + e.message);
  }
}