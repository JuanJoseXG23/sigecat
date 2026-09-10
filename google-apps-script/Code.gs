/*
 * SIGECAT - alertas diarias de vencimiento
 *
 * Este archivo se ejecuta desde un proyecto independiente de Google Apps Script.
 * No guarda claves: usa el token OAuth de la cuenta institucional que crea el trigger.
 */
const TIME_ZONE = 'America/Bogota';

function setupDailyDeadlineAlerts() {
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  if (!projectId) throw new Error('Configura la propiedad FIREBASE_PROJECT_ID antes de activar el envío.');

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'sendDeadlineAlerts')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('sendDeadlineAlerts').timeBased().everyDays(1).atHour(8).create();
  console.log('Alerta diaria creada. Google la ejecutará aproximadamente entre las 08:00 y 09:00 de Colombia.');
}

function disableDailyDeadlineAlerts() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'sendDeadlineAlerts')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

function sendDeadlineAlerts() {
  const configuration = getDocument_('configuracion/reglasNegocio') || {};
  if (configuration.alertasCorreoHabilitadas !== true) {
    console.log('Las alertas por correo están desactivadas desde SIGECAT.');
    return;
  }

  const threshold = Number(configuration.umbralProximoVencer || 3);
  const holidays = new Set(configuration.diasFestivos || []);
  const users = {};

  queryActiveExpedients_().forEach((expedient) => {
    const data = expedient.data;
    const official = data.funcionarioAsignado;
    if (!data.fechaLimite || !official || !official.uid) return;

    const remaining = remainingBusinessDays_(data.fechaLimite, new Date(), holidays);
    if (remaining < 0 || remaining > threshold) return;

    const deadlineKey = dateKey_(new Date(data.fechaLimite));
    const alertKey = `${official.uid}|${deadlineKey}`;
    if (data.ultimaAlertaVencimiento && data.ultimaAlertaVencimiento.clave === alertKey) return;

    if (!(official.uid in users)) users[official.uid] = getDocument_(`usuarios/${official.uid}`);
    const recipient = users[official.uid];
    if (!recipient || recipient.activo !== true || recipient.recibeAlertasVencimiento !== true || !recipient.correo) return;

    const filing = data.numeroRadicado || expedient.id;
    const deadline = new Date(data.fechaLimite).toLocaleDateString('es-CO', { timeZone: TIME_ZONE });
    const label = remaining === 0
      ? 'vence hoy'
      : `vence en ${remaining} día${remaining === 1 ? '' : 's'} hábil${remaining === 1 ? '' : 'es'}`;
    const subject = `SIGECAT: el radicado ${filing} ${label}`;
    const body = `Hola ${official.nombreCompleto || ''},\n\nEl expediente ${filing}${data.tipoTramite ? ` (${data.tipoTramite})` : ''} ${label}.\nLa fecha límite de respuesta es ${deadline}.\n\nIngresa a SIGECAT para gestionar la respuesta.`;

    try {
      MailApp.sendEmail({ to: recipient.correo, subject, body, htmlBody: body.replace(/\n/g, '<br>') });
      patchDocument_(expedient.id, {
        ultimaAlertaVencimiento: { clave: alertKey, fecha: new Date() },
      });
      console.log(`Alerta enviada para ${filing} a ${recipient.correo}.`);
    } catch (error) {
      console.error(`No fue posible enviar la alerta del expediente ${expedient.id}: ${error}`);
    }
  });
}

function queryActiveExpedients_() {
  const response = firestoreRequest_(':runQuery', 'post', {
    structuredQuery: {
      from: [{ collectionId: 'expedientes' }],
      where: { fieldFilter: { field: { fieldPath: 'activo' }, op: 'EQUAL', value: { booleanValue: true } } },
    },
  });
  return response.filter((item) => item.document).map((item) => ({
    id: item.document.name.split('/').pop(),
    data: decodeFields_(item.document.fields || {}),
  }));
}

function getDocument_(path) {
  const response = firestoreRequest_(`/documents/${path}`, 'get');
  return response ? decodeFields_(response.fields || {}) : null;
}

function patchDocument_(id, values) {
  const fields = {};
  Object.keys(values).forEach((key) => { fields[key] = encodeValue_(values[key]); });
  firestoreRequest_(`/documents/expedientes/${id}?updateMask.fieldPaths=ultimaAlertaVencimiento`, 'patch', { fields });
}

function firestoreRequest_(path, method, payload) {
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)${path}`;
  const response = UrlFetchApp.fetch(url, {
    method,
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: payload ? JSON.stringify(payload) : undefined,
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  if (status === 404 && method === 'get') return null;
  if (status < 200 || status >= 300) throw new Error(`Firestore ${status}: ${response.getContentText()}`);
  const text = response.getContentText();
  return text ? JSON.parse(text) : null;
}

function decodeFields_(fields) {
  const result = {};
  Object.keys(fields).forEach((key) => { result[key] = decodeValue_(fields[key]); });
  return result;
}

function decodeValue_(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) return decodeFields_(value.mapValue.fields || {});
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue_);
  return null;
}

function encodeValue_(value) {
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue_) } };
  if (value && typeof value === 'object') {
    const fields = {};
    Object.keys(value).forEach((key) => { fields[key] = encodeValue_(value[key]); });
    return { mapValue: { fields } };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  return { stringValue: String(value) };
}

function dateKey_(date) {
  return Utilities.formatDate(date, TIME_ZONE, 'yyyy-MM-dd');
}

function dateAtStart_(date) {
  return new Date(`${dateKey_(date)}T00:00:00-05:00`);
}

function remainingBusinessDays_(deadline, today, holidays) {
  const target = dateAtStart_(deadline);
  const cursor = dateAtStart_(today);
  const direction = target.getTime() >= cursor.getTime() ? 1 : -1;
  let days = 0;
  while (cursor.getTime() !== target.getTime()) {
    cursor.setDate(cursor.getDate() + direction);
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(dateKey_(cursor))) days += direction;
  }
  return days;
}
