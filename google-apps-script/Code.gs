/* SIGECAT - alertas diarias de vencimiento. Compatible con Apps Script clásico. */
var TIME_ZONE = 'America/Bogota'

function setupDailyDeadlineAlerts() {
  var projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID')
  if (!projectId) throw new Error('Configura FIREBASE_PROJECT_ID antes de activar el envio.')
  deleteDeadlineAlertTriggers_()
  ScriptApp.newTrigger('sendDeadlineAlerts').timeBased().everyDays(1).atHour(8).create()
  ScriptApp.newTrigger('processEmailTestRequests').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('processAssignmentNotifications').timeBased().everyMinutes(5).create()
  ScriptApp.newTrigger('processManagementInquiries').timeBased().everyMinutes(5).create()
  Logger.log('Alerta diaria creada correctamente.')
}

function disableDailyDeadlineAlerts() {
  deleteDeadlineAlertTriggers_()
}

/* Ejecuta esta función manualmente desde Apps Script para comprobar la configuración. */
function sendTestDeadlineAlert() {
  var recipient = Session.getEffectiveUser().getEmail()
  if (!recipient) {
    throw new Error('No se pudo identificar el correo de la cuenta que ejecuta el script.')
  }

  var configuration = getDocument_('configuracion/reglasNegocio') || {}
  MailApp.sendEmail({
    to: recipient,
    subject: 'SIGECAT: prueba de alertas por correo',
    body:
      'La prueba fue exitosa. El proceso de alertas de SIGECAT puede consultar Firestore y enviar correos desde esta cuenta institucional. Alertas habilitadas: ' +
      (configuration.alertasCorreoHabilitadas === true ? 'si' : 'no') +
      '.',
  })
  Logger.log('Correo de prueba enviado a ' + recipient + '.')
}

function deleteDeadlineAlertTriggers_() {
  var triggers = ScriptApp.getProjectTriggers()
  for (var i = 0; i < triggers.length; i = i + 1) {
    if (
      triggers[i].getHandlerFunction() === 'sendDeadlineAlerts' ||
      triggers[i].getHandlerFunction() === 'processEmailTestRequests' ||
      triggers[i].getHandlerFunction() === 'processAssignmentNotifications' ||
      triggers[i].getHandlerFunction() === 'processManagementInquiries'
    ) {
      ScriptApp.deleteTrigger(triggers[i])
    }
  }
}

function processEmailTestRequests() {
  var requests = queryPendingEmailTests_()
  for (var i = 0; i < requests.length; i = i + 1) {
    var request = requests[i]
    try {
      var emailOptions = {
        to: request.data.destinatarioCorreo,
        subject: 'SIGECAT: prueba de alertas por correo',
        body:
          'Hola ' +
          (request.data.destinatarioNombre || '') +
          '.\n\nEsta es una prueba solicitada desde la configuración de SIGECAT. Si recibes este mensaje, las alertas por correo están funcionando correctamente.',
      }
      if (
        request.data.solicitadoPorCorreo &&
        request.data.solicitadoPorCorreo !== request.data.destinatarioCorreo
      ) {
        emailOptions.cc = request.data.solicitadoPorCorreo
      }
      MailApp.sendEmail(emailOptions)
      patchFields_('solicitudesPruebaCorreo/' + request.id, {
        estado: 'Enviado',
        fechaProcesamiento: new Date(),
      })
    } catch (error) {
      patchFields_('solicitudesPruebaCorreo/' + request.id, {
        estado: 'Error',
        detalleError: String(error),
        fechaProcesamiento: new Date(),
      })
    }
  }
}

function processAssignmentNotifications() {
  var notifications = queryPendingAssignmentNotifications_()
  for (var i = 0; i < notifications.length; i = i + 1) {
    var notification = notifications[i]
    var data = notification.data
    try {
      // La solicitud solo trae identificadores; correo y contenido se leen de Firestore
      // para que nadie pueda usar la cuenta institucional con datos inventados.
      if (!data.expedienteId || !data.destinatarioUid)
        throw new Error('Solicitud sin expediente o destinatario.')
      var expedient = getDocument_('expedientes/' + data.expedienteId)
      if (!expedient) throw new Error('El expediente no existe.')
      if (
        !expedient.funcionarioAsignado ||
        expedient.funcionarioAsignado.uid !== data.destinatarioUid
      ) {
        patchFields_('notificacionesAsignacion/' + notification.id, {
          estado: 'Omitido',
          detalleError: 'El expediente ya no está asignado a este destinatario.',
          fechaProcesamiento: new Date(),
        })
        continue
      }
      var recipient = getDocument_('usuarios/' + data.destinatarioUid)
      if (!recipient || recipient.activo !== true || !recipient.correo)
        throw new Error('El destinatario no está activo o no tiene correo.')
      var applicant =
        expedient.solicitantes && expedient.solicitantes[0] ? expedient.solicitantes[0].nombre : ''
      var deadline = expedient.fechaLimite
        ? Utilities.formatDate(new Date(expedient.fechaLimite), TIME_ZONE, 'dd/MM/yyyy')
        : 'No registrada'
      var body =
        'Hola ' +
        (recipient.nombreCompleto || '') +
        ',\n\nTienes un nuevo expediente asignado.\n\nNúmero de expediente: ' +
        (expedient.numeroRadicado || '') +
        '\nTrámite: ' +
        (expedient.tipoTramite || 'No registrado') +
        '\nSolicitante: ' +
        (applicant || 'No registrado') +
        '\nFecha límite de respuesta: ' +
        deadline +
        '\n\nIngresa a SIGECAT para gestionarlo.'
      MailApp.sendEmail({
        to: recipient.correo,
        subject: 'SIGECAT: nuevo expediente asignado - ' + (expedient.numeroRadicado || ''),
        body: body,
      })
      patchFields_('notificacionesAsignacion/' + notification.id, {
        estado: 'Enviado',
        fechaProcesamiento: new Date(),
      })
    } catch (error) {
      patchFields_('notificacionesAsignacion/' + notification.id, {
        estado: 'Error',
        detalleError: String(error),
        fechaProcesamiento: new Date(),
      })
    }
  }
}

/* Preguntas de la jefatura al responsable de un expediente (colección consultasDireccion).
   La solicitud solo trae identificadores y el texto: el correo del destinatario y de quien
   pregunta se leen de Firestore. La respuesta llega directo a quien preguntó (replyTo). */
function processManagementInquiries() {
  var inquiries = queryPending_('consultasDireccion')
  var appUrl =
    PropertiesService.getScriptProperties().getProperty('APP_URL') ||
    'https://juanjosexg23.github.io/sigecat/'
  for (var i = 0; i < inquiries.length; i = i + 1) {
    var inquiry = inquiries[i]
    var data = inquiry.data
    var path = 'consultasDireccion/' + inquiry.id
    try {
      if (!data.expedienteId || !data.destinatarioUid || !data.solicitadoPor)
        throw new Error('Solicitud incompleta.')
      var expedient = getDocument_('expedientes/' + data.expedienteId)
      if (!expedient) throw new Error('El expediente no existe.')
      if (
        !expedient.funcionarioAsignado ||
        expedient.funcionarioAsignado.uid !== data.destinatarioUid
      ) {
        patchFields_(path, {
          estado: 'Omitido',
          detalleError: 'El expediente ya no está asignado a este destinatario.',
          fechaProcesamiento: new Date(),
        })
        continue
      }
      var recipient = getDocument_('usuarios/' + data.destinatarioUid)
      if (!recipient || recipient.activo !== true || !recipient.correo)
        throw new Error('El destinatario no está activo o no tiene correo.')
      var requester = getDocument_('usuarios/' + data.solicitadoPor)
      if (!requester || requester.activo !== true || !requester.correo)
        throw new Error('Quien pregunta no está activo o no tiene correo.')

      var filing = expedient.numeroRadicado || data.expedienteId
      var applicant =
        expedient.solicitantes && expedient.solicitantes[0] ? expedient.solicitantes[0].nombre : ''
      var deadline = expedient.fechaLimite
        ? Utilities.formatDate(new Date(expedient.fechaLimite), TIME_ZONE, 'dd/MM/yyyy')
        : 'No registrada'
      var link = appUrl + '#/expedientes/' + data.expedienteId
      var question = String(data.pregunta || '')
      var body =
        'Hola ' +
        (recipient.nombreCompleto || '') +
        ',\n\n' +
        (requester.nombreCompleto || 'La dirección') +
        (requester.cargo ? ' (' + requester.cargo + ')' : '') +
        ' pregunta por el expediente ' +
        filing +
        ':\n\n"' +
        question +
        '"\n\nEstado actual: ' +
        (expedient.estado || 'Sin estado') +
        '\nTrámite: ' +
        (expedient.tipoTramite || 'No registrado') +
        '\nSolicitante: ' +
        (applicant || 'No registrado') +
        '\nFecha límite de respuesta: ' +
        deadline +
        '\n\nResponde a este correo para contestarle directamente.\nVer el expediente: ' +
        link
      MailApp.sendEmail({
        to: recipient.correo,
        cc: requester.correo,
        replyTo: requester.correo,
        name: 'SIGECAT',
        subject:
          'SIGECAT: ' +
          (requester.nombreCompleto || 'La dirección') +
          ' pregunta por el radicado ' +
          filing,
        body: body,
      })
      // Deja la pregunta en el historial del expediente para que el equipo la vea.
      firestoreRequest_('/documents/expedientes/' + data.expedienteId + '/historial', 'post', {
        fields: {
          usuario: encodeValue_(data.solicitadoPor),
          accion: encodeValue_('Pregunta de la dirección'),
          detalle: encodeValue_('A ' + (recipient.nombreCompleto || '') + ': ' + question),
          fecha: encodeValue_(new Date()),
        },
      })
      patchFields_(path, { estado: 'Enviado', fechaProcesamiento: new Date() })
    } catch (error) {
      patchFields_(path, {
        estado: 'Error',
        detalleError: String(error),
        fechaProcesamiento: new Date(),
      })
    }
  }
}

function queryPending_(collectionId) {
  var response = firestoreRequest_('/documents:runQuery', 'post', {
    structuredQuery: {
      from: [{ collectionId: collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'estado' },
          op: 'EQUAL',
          value: { stringValue: 'Pendiente' },
        },
      },
    },
  })
  var results = []
  for (var i = 0; i < response.length; i = i + 1) {
    if (response[i].document) {
      var document = response[i].document
      results.push({
        id: document.name.split('/').pop(),
        data: decodeFields_(document.fields || {}),
      })
    }
  }
  return results
}

function sendDeadlineAlerts() {
  var configuration = getDocument_('configuracion/reglasNegocio') || {}
  if (configuration.alertasCorreoHabilitadas !== true) {
    Logger.log('Las alertas por correo estan desactivadas desde SIGECAT.')
    return
  }

  var threshold = Number(configuration.umbralProximoVencer || 3)
  var holidayMap = {}
  var holidayList = configuration.diasFestivos || []
  for (var h = 0; h < holidayList.length; h = h + 1) holidayMap[holidayList[h]] = true

  var users = {}
  var expedients = queryActiveExpedients_()
  for (var i = 0; i < expedients.length; i = i + 1) {
    sendDeadlineAlertForExpedient_(expedients[i], threshold, holidayMap, users)
  }
}

function sendDeadlineAlertForExpedient_(expedient, threshold, holidayMap, users) {
  var data = expedient.data
  var official = data.funcionarioAsignado
  if (!data.fechaLimite || !official || !official.uid) return

  var remaining = remainingBusinessDays_(data.fechaLimite, new Date(), holidayMap)
  if (remaining < 0 || remaining > threshold) return

  var deadlineKey = dateKey_(new Date(data.fechaLimite))
  var alertKey = official.uid + '|' + deadlineKey
  if (data.ultimaAlertaVencimiento && data.ultimaAlertaVencimiento.clave === alertKey) return

  if (!users.hasOwnProperty(official.uid))
    users[official.uid] = getDocument_('usuarios/' + official.uid)
  var recipient = users[official.uid]
  if (
    !recipient ||
    recipient.activo !== true ||
    recipient.recibeAlertasVencimiento !== true ||
    !recipient.correo
  )
    return

  var filing = data.numeroRadicado || expedient.id
  var deadline = Utilities.formatDate(new Date(data.fechaLimite), TIME_ZONE, 'dd/MM/yyyy')
  var label =
    remaining === 0
      ? 'vence hoy'
      : 'vence en ' +
        remaining +
        ' dia' +
        (remaining === 1 ? '' : 's') +
        ' habil' +
        (remaining === 1 ? '' : 'es')
  var subject = 'SIGECAT: el radicado ' + filing + ' ' + label
  var body =
    'Hola ' +
    (official.nombreCompleto || '') +
    ',\n\nEl expediente ' +
    filing +
    (data.tipoTramite ? ' (' + data.tipoTramite + ')' : '') +
    ' ' +
    label +
    '.\nLa fecha limite de respuesta es ' +
    deadline +
    '.\n\nIngresa a SIGECAT para gestionar la respuesta.'

  try {
    MailApp.sendEmail({
      to: recipient.correo,
      subject: subject,
      body: body,
      htmlBody: body.replace(/\n/g, '<br>'),
    })
    patchDocument_(expedient.id, {
      ultimaAlertaVencimiento: { clave: alertKey, fecha: new Date() },
    })
    Logger.log('Alerta enviada para ' + filing + ' a ' + recipient.correo + '.')
  } catch (error) {
    Logger.log('No fue posible enviar la alerta del expediente ' + expedient.id + ': ' + error)
  }
}

function queryActiveExpedients_() {
  var response = firestoreRequest_('/documents:runQuery', 'post', {
    structuredQuery: {
      from: [{ collectionId: 'expedientes' }],
      where: {
        fieldFilter: { field: { fieldPath: 'activo' }, op: 'EQUAL', value: { booleanValue: true } },
      },
    },
  })
  var results = []
  for (var i = 0; i < response.length; i = i + 1) {
    if (response[i].document) {
      var document = response[i].document
      results.push({
        id: document.name.split('/').pop(),
        data: decodeFields_(document.fields || {}),
      })
    }
  }
  return results
}

function queryPendingEmailTests_() {
  var response = firestoreRequest_('/documents:runQuery', 'post', {
    structuredQuery: {
      from: [{ collectionId: 'solicitudesPruebaCorreo' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'estado' },
          op: 'EQUAL',
          value: { stringValue: 'Pendiente' },
        },
      },
    },
  })
  var results = []
  for (var i = 0; i < response.length; i = i + 1) {
    if (response[i].document) {
      var document = response[i].document
      results.push({
        id: document.name.split('/').pop(),
        data: decodeFields_(document.fields || {}),
      })
    }
  }
  return results
}

function queryPendingAssignmentNotifications_() {
  var response = firestoreRequest_('/documents:runQuery', 'post', {
    structuredQuery: {
      from: [{ collectionId: 'notificacionesAsignacion' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'estado' },
          op: 'EQUAL',
          value: { stringValue: 'Pendiente' },
        },
      },
    },
  })
  var results = []
  for (var i = 0; i < response.length; i = i + 1) {
    if (response[i].document) {
      var document = response[i].document
      results.push({
        id: document.name.split('/').pop(),
        data: decodeFields_(document.fields || {}),
      })
    }
  }
  return results
}

function getDocument_(path) {
  var response = firestoreRequest_('/documents/' + path, 'get')
  return response ? decodeFields_(response.fields || {}) : null
}

function patchDocument_(id, values) {
  var fields = {}
  var keys = Object.keys(values)
  for (var i = 0; i < keys.length; i = i + 1) fields[keys[i]] = encodeValue_(values[keys[i]])
  firestoreRequest_(
    '/documents/expedientes/' + id + '?updateMask.fieldPaths=ultimaAlertaVencimiento',
    'patch',
    { fields: fields },
  )
}

function patchFields_(path, values) {
  var fields = {}
  var keys = Object.keys(values)
  var masks = []
  for (var i = 0; i < keys.length; i = i + 1) {
    fields[keys[i]] = encodeValue_(values[keys[i]])
    masks.push('updateMask.fieldPaths=' + keys[i])
  }
  firestoreRequest_('/documents/' + path + '?' + masks.join('&'), 'patch', { fields: fields })
}

function firestoreRequest_(path, method, payload) {
  var projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID')
  var url =
    'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)' + path
  var options = {
    method: method,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  }
  if (payload) options.payload = JSON.stringify(payload)
  var response = UrlFetchApp.fetch(url, options)
  var status = response.getResponseCode()
  if (status === 404 && method === 'get') return null
  if (status < 200 || status >= 300)
    throw new Error('Firestore ' + status + ': ' + response.getContentText())
  var text = response.getContentText()
  return text ? JSON.parse(text) : null
}

function decodeFields_(fields) {
  var result = {}
  var keys = Object.keys(fields)
  for (var i = 0; i < keys.length; i = i + 1) result[keys[i]] = decodeValue_(fields[keys[i]])
  return result
}

function decodeValue_(value) {
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('booleanValue' in value) return value.booleanValue
  if ('timestampValue' in value) return value.timestampValue
  if ('mapValue' in value) return decodeFields_(value.mapValue.fields || {})
  if ('arrayValue' in value) {
    var values = value.arrayValue.values || []
    var result = []
    for (var i = 0; i < values.length; i = i + 1) result.push(decodeValue_(values[i]))
    return result
  }
  return null
}

function encodeValue_(value) {
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Object.prototype.toString.call(value) === '[object Array]') {
    var encoded = []
    for (var i = 0; i < value.length; i = i + 1) encoded.push(encodeValue_(value[i]))
    return { arrayValue: { values: encoded } }
  }
  if (value && typeof value === 'object') {
    var fields = {}
    var keys = Object.keys(value)
    for (var j = 0; j < keys.length; j = j + 1) fields[keys[j]] = encodeValue_(value[keys[j]])
    return { mapValue: { fields: fields } }
  }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return { doubleValue: value }
  return { stringValue: String(value) }
}

function dateKey_(date) {
  return Utilities.formatDate(date, TIME_ZONE, 'yyyy-MM-dd')
}

function dateAtStart_(date) {
  return new Date(dateKey_(date) + 'T00:00:00-05:00')
}

function remainingBusinessDays_(deadline, today, holidayMap) {
  var target = dateAtStart_(deadline)
  var cursor = dateAtStart_(today)
  var direction = target.getTime() >= cursor.getTime() ? 1 : -1
  var days = 0
  while (cursor.getTime() !== target.getTime()) {
    cursor.setDate(cursor.getDate() + direction)
    var weekday = cursor.getDay()
    if (weekday !== 0 && weekday !== 6 && !isHoliday_(dateKey_(cursor), holidayMap))
      days += direction
  }
  return days
}

/* Festivos nacionales de Colombia (Ley 51 de 1983). Repite src/lib/colombian-holidays.ts:
   si cambia uno, debe cambiar el otro. holidayMap trae los dias adicionales de SIGECAT. */
function isHoliday_(key, holidayMap) {
  return holidayMap[key] === true || colombianHolidays_(Number(key.slice(0, 4)))[key] === true
}

var colombianHolidayCache_ = {}

function colombianHolidays_(year) {
  if (colombianHolidayCache_[year]) return colombianHolidayCache_[year]

  function utc(month, day) {
    return new Date(Date.UTC(year, month - 1, day))
  }
  function plus(date, days) {
    return new Date(date.getTime() + days * 86400000)
  }
  function monday(date) {
    return plus(date, (8 - date.getUTCDay()) % 7)
  }

  // Domingo de Pascua (algoritmo de Meeus/Jones/Butcher).
  var a = year % 19
  var b = Math.floor(year / 100)
  var c = year % 100
  var d = Math.floor(b / 4)
  var e = b % 4
  var f = Math.floor((b + 8) / 25)
  var g = Math.floor((b - f + 1) / 3)
  var h = (19 * a + b - d - g + 15) % 30
  var i = Math.floor(c / 4)
  var k = c % 4
  var l = (32 + 2 * e + 2 * i - h - k) % 7
  var m = Math.floor((a + 11 * h + 22 * l) / 451)
  var easter = utc(Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1)

  var dates = [
    utc(1, 1),
    utc(5, 1),
    utc(7, 20),
    utc(8, 7),
    utc(12, 8),
    utc(12, 25),
    monday(utc(1, 6)),
    monday(utc(3, 19)),
    monday(utc(6, 29)),
    monday(utc(8, 15)),
    monday(utc(10, 12)),
    monday(utc(11, 1)),
    monday(utc(11, 11)),
    plus(easter, -3),
    plus(easter, -2),
    monday(plus(easter, 39)),
    monday(plus(easter, 60)),
    monday(plus(easter, 68)),
  ]
  var map = {}
  for (var n = 0; n < dates.length; n = n + 1) map[dates[n].toISOString().slice(0, 10)] = true
  colombianHolidayCache_[year] = map
  return map
}
