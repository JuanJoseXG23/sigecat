/* SIGECAT - alertas diarias de vencimiento. Compatible con Apps Script clásico. */
var TIME_ZONE = 'America/Bogota';

function setupDailyDeadlineAlerts() {
  var projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  if (!projectId) throw new Error('Configura FIREBASE_PROJECT_ID antes de activar el envio.');
  deleteDeadlineAlertTriggers_();
  ScriptApp.newTrigger('sendDeadlineAlerts').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('processEmailTestRequests').timeBased().everyMinutes(5).create();
  Logger.log('Alerta diaria creada correctamente.');
}

function disableDailyDeadlineAlerts() {
  deleteDeadlineAlertTriggers_();
}

/* Ejecuta esta función manualmente desde Apps Script para comprobar la configuración. */
function sendTestDeadlineAlert() {
  var recipient = Session.getEffectiveUser().getEmail();
  if (!recipient) {
    throw new Error('No se pudo identificar el correo de la cuenta que ejecuta el script.');
  }

  var configuration = getDocument_('configuracion/reglasNegocio') || {};
  MailApp.sendEmail({
    to: recipient,
    subject: 'SIGECAT: prueba de alertas por correo',
    body: 'La prueba fue exitosa. El proceso de alertas de SIGECAT puede consultar Firestore y enviar correos desde esta cuenta institucional. Alertas habilitadas: ' + (configuration.alertasCorreoHabilitadas === true ? 'si' : 'no') + '.'
  });
  Logger.log('Correo de prueba enviado a ' + recipient + '.');
}

function deleteDeadlineAlertTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i = i + 1) {
    if (triggers[i].getHandlerFunction() === 'sendDeadlineAlerts' || triggers[i].getHandlerFunction() === 'processEmailTestRequests') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function processEmailTestRequests() {
  var requests = queryPendingEmailTests_();
  for (var i = 0; i < requests.length; i = i + 1) {
    var request = requests[i];
    try {
      MailApp.sendEmail({
        to: request.data.destinatarioCorreo,
        subject: 'SIGECAT: prueba de alertas por correo',
        body: 'Hola ' + (request.data.destinatarioNombre || '') + '.\n\nEsta es una prueba solicitada desde la configuración de SIGECAT. Si recibes este mensaje, las alertas por correo están funcionando correctamente.'
      });
      patchFields_('solicitudesPruebaCorreo/' + request.id, { estado: 'Enviado', fechaProcesamiento: new Date() });
    } catch (error) {
      patchFields_('solicitudesPruebaCorreo/' + request.id, { estado: 'Error', detalleError: String(error), fechaProcesamiento: new Date() });
    }
  }
}

function sendDeadlineAlerts() {
  var configuration = getDocument_('configuracion/reglasNegocio') || {};
  if (configuration.alertasCorreoHabilitadas !== true) {
    Logger.log('Las alertas por correo estan desactivadas desde SIGECAT.');
    return;
  }

  var threshold = Number(configuration.umbralProximoVencer || 3);
  var holidayMap = {};
  var holidayList = configuration.diasFestivos || [];
  for (var h = 0; h < holidayList.length; h = h + 1) holidayMap[holidayList[h]] = true;

  var users = {};
  var expedients = queryActiveExpedients_();
  for (var i = 0; i < expedients.length; i = i + 1) {
    sendDeadlineAlertForExpedient_(expedients[i], threshold, holidayMap, users);
  }
}

function sendDeadlineAlertForExpedient_(expedient, threshold, holidayMap, users) {
  var data = expedient.data;
  var official = data.funcionarioAsignado;
  if (!data.fechaLimite || !official || !official.uid) return;

  var remaining = remainingBusinessDays_(data.fechaLimite, new Date(), holidayMap);
  if (remaining < 0 || remaining > threshold) return;

  var deadlineKey = dateKey_(new Date(data.fechaLimite));
  var alertKey = official.uid + '|' + deadlineKey;
  if (data.ultimaAlertaVencimiento && data.ultimaAlertaVencimiento.clave === alertKey) return;

  if (!users.hasOwnProperty(official.uid)) users[official.uid] = getDocument_('usuarios/' + official.uid);
  var recipient = users[official.uid];
  if (!recipient || recipient.activo !== true || recipient.recibeAlertasVencimiento !== true || !recipient.correo) return;

  var filing = data.numeroRadicado || expedient.id;
  var deadline = Utilities.formatDate(new Date(data.fechaLimite), TIME_ZONE, 'dd/MM/yyyy');
  var label = remaining === 0 ? 'vence hoy' : 'vence en ' + remaining + ' dia' + (remaining === 1 ? '' : 's') + ' habil' + (remaining === 1 ? '' : 'es');
  var subject = 'SIGECAT: el radicado ' + filing + ' ' + label;
  var body = 'Hola ' + (official.nombreCompleto || '') + ',\n\nEl expediente ' + filing + (data.tipoTramite ? ' (' + data.tipoTramite + ')' : '') + ' ' + label + '.\nLa fecha limite de respuesta es ' + deadline + '.\n\nIngresa a SIGECAT para gestionar la respuesta.';

  try {
    MailApp.sendEmail({ to: recipient.correo, subject: subject, body: body, htmlBody: body.replace(/\n/g, '<br>') });
    patchDocument_(expedient.id, { ultimaAlertaVencimiento: { clave: alertKey, fecha: new Date() } });
    Logger.log('Alerta enviada para ' + filing + ' a ' + recipient.correo + '.');
  } catch (error) {
    Logger.log('No fue posible enviar la alerta del expediente ' + expedient.id + ': ' + error);
  }
}

function queryActiveExpedients_() {
  var response = firestoreRequest_(':runQuery', 'post', {
    structuredQuery: {
      from: [{ collectionId: 'expedientes' }],
      where: { fieldFilter: { field: { fieldPath: 'activo' }, op: 'EQUAL', value: { booleanValue: true } } }
    }
  });
  var results = [];
  for (var i = 0; i < response.length; i = i + 1) {
    if (response[i].document) {
      var document = response[i].document;
      results.push({ id: document.name.split('/').pop(), data: decodeFields_(document.fields || {}) });
    }
  }
  return results;
}

function queryPendingEmailTests_() {
  var response = firestoreRequest_(':runQuery', 'post', {
    structuredQuery: {
      from: [{ collectionId: 'solicitudesPruebaCorreo' }],
      where: { fieldFilter: { field: { fieldPath: 'estado' }, op: 'EQUAL', value: { stringValue: 'Pendiente' } } }
    }
  });
  var results = [];
  for (var i = 0; i < response.length; i = i + 1) {
    if (response[i].document) {
      var document = response[i].document;
      results.push({ id: document.name.split('/').pop(), data: decodeFields_(document.fields || {}) });
    }
  }
  return results;
}

function getDocument_(path) {
  var response = firestoreRequest_('/documents/' + path, 'get');
  return response ? decodeFields_(response.fields || {}) : null;
}

function patchDocument_(id, values) {
  var fields = {};
  var keys = Object.keys(values);
  for (var i = 0; i < keys.length; i = i + 1) fields[keys[i]] = encodeValue_(values[keys[i]]);
  firestoreRequest_('/documents/expedientes/' + id + '?updateMask.fieldPaths=ultimaAlertaVencimiento', 'patch', { fields: fields });
}

function patchFields_(path, values) {
  var fields = {};
  var keys = Object.keys(values);
  var masks = [];
  for (var i = 0; i < keys.length; i = i + 1) {
    fields[keys[i]] = encodeValue_(values[keys[i]]);
    masks.push('updateMask.fieldPaths=' + keys[i]);
  }
  firestoreRequest_('/documents/' + path + '?' + masks.join('&'), 'patch', { fields: fields });
}

function firestoreRequest_(path, method, payload) {
  var projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)' + path;
  var options = { method: method, contentType: 'application/json', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  if (payload) options.payload = JSON.stringify(payload);
  var response = UrlFetchApp.fetch(url, options);
  var status = response.getResponseCode();
  if (status === 404 && method === 'get') return null;
  if (status < 200 || status >= 300) throw new Error('Firestore ' + status + ': ' + response.getContentText());
  var text = response.getContentText();
  return text ? JSON.parse(text) : null;
}

function decodeFields_(fields) {
  var result = {};
  var keys = Object.keys(fields);
  for (var i = 0; i < keys.length; i = i + 1) result[keys[i]] = decodeValue_(fields[keys[i]]);
  return result;
}

function decodeValue_(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) return decodeFields_(value.mapValue.fields || {});
  if ('arrayValue' in value) {
    var values = value.arrayValue.values || [];
    var result = [];
    for (var i = 0; i < values.length; i = i + 1) result.push(decodeValue_(values[i]));
    return result;
  }
  return null;
}

function encodeValue_(value) {
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Object.prototype.toString.call(value) === '[object Array]') {
    var encoded = [];
    for (var i = 0; i < value.length; i = i + 1) encoded.push(encodeValue_(value[i]));
    return { arrayValue: { values: encoded } };
  }
  if (value && typeof value === 'object') {
    var fields = {};
    var keys = Object.keys(value);
    for (var j = 0; j < keys.length; j = j + 1) fields[keys[j]] = encodeValue_(value[keys[j]]);
    return { mapValue: { fields: fields } };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  return { stringValue: String(value) };
}

function dateKey_(date) {
  return Utilities.formatDate(date, TIME_ZONE, 'yyyy-MM-dd');
}

function dateAtStart_(date) {
  return new Date(dateKey_(date) + 'T00:00:00-05:00');
}

function remainingBusinessDays_(deadline, today, holidayMap) {
  var target = dateAtStart_(deadline);
  var cursor = dateAtStart_(today);
  var direction = target.getTime() >= cursor.getTime() ? 1 : -1;
  var days = 0;
  while (cursor.getTime() !== target.getTime()) {
    cursor.setDate(cursor.getDate() + direction);
    var weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6 && !holidayMap[dateKey_(cursor)]) days += direction;
  }
  return days;
}
