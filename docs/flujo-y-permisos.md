# Flujo del expediente y permisos

## Roles

| Rol           | Puede                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrador | Todo: usuarios, tipos de trámite, configuración, reportes; corregir expedientes cerrados, radicados y documentos                                                                         |
| Coordinador   | Gestionar y archivar cualquier expediente; corregir expedientes cerrados, radicados y documentos; ver reportes                                                                           |
| Funcionario   | Registrar expedientes en su área. Ve solo los que registró, tiene o tuvo asignados (`participantes`); gestiona los que tiene asignados y los que registró mientras no tengan responsable |
| Directivo     | La jefatura: Panel de dirección, ver todo y preguntar por correo a los responsables; no modifica expedientes                                                                             |
| Consulta      | Ver todo (dashboard, expedientes, biblioteca, histórico); no modifica nada                                                                                                               |

Menú por rol (definido en `src/routes/navigation.ts`):

| Sección                                       | Admin | Coord. | Func. | Consulta |
| --------------------------------------------- | :---: | :----: | :---: | :------: |
| Dashboard, Expedientes, Biblioteca, Histórico |   ✓   |   ✓    |   ✓   |    ✓     |
| Mi Agenda, Radicación                         |   ✓   |   ✓    |   ✓   |          |
| Reportes                                      |   ✓   |   ✓    |       |          |
| Usuarios, Tipos de trámite, Configuración     |   ✓   |        |       |          |
| Guía rápida (Ayuda)                           |   ✓   |   ✓    |   ✓   |    ✓     |

Los usuarios se crean con `npm run user:create` (ver README); la página Usuarios permite editar
datos, rol y activar o desactivar cuentas.

## Áreas de la Secretaría

Catastro, Cobro coactivo, Impuestos, Fiscalización, Contabilidad, Tesorería y Presupuesto
(`src/lib/dependencies.ts`; para agregar una basta con sumarla allí). Cada usuario pertenece a
una sola área y cada expediente tiene el área que lo lidera: al registrarlo es la de quien lo
registra; Administrador y Coordinador la eligen o la cambian (queda en el historial). Los
expedientes anteriores a las áreas son de Catastro. Expedientes, Histórico, Reportes y el Panel
de dirección filtran por área.

Cada expediente guarda en `participantes` a quien lo registró, a quienes lo tuvieron asignado y a
quienes actuaron sobre él. Es la base de la separación por áreas que se activará con las nuevas
reglas: el Funcionario verá solo los expedientes donde figura (ver
[diseño](diseno-dependencias-y-permisos.md)).

## Panel de dirección

Para la jefatura (rol **Directivo**; también lo ven Administrador y Coordinador). Es la página de
inicio del Directivo (`#/direccion`). Los expedientes en trámite y las preguntas se actualizan
solos cada 15 minutos; los cerrados, con el botón **Actualizar** o al actuar sobre un expediente.
Para no agotar la cuota diaria de lecturas de Firestore, el panel solo descarga los cerrados
desde el inicio del año o de los seis meses de la gráfica (lo que empiece antes).

- **Indicadores:** en trámite, vencidos, próximos a vencer, respondidos este mes y porcentaje de
  respuesta oportuna del año (con la fecha real de la respuesta).
- **Gráficas:** semáforo de términos, expedientes por paso del flujo, radicados y respondidos de
  los últimos seis meses (con vista de datos) y carga por responsable. Tocar una barra, un
  indicador o una persona filtra la lista de abajo.
- **Expedientes en trámite:** del más urgente al menos urgente, con búsqueda y botón
  **Preguntar**. Debajo, los respondidos recientemente y **Mis preguntas** con su estado.

**Preguntar al responsable** (también desde el detalle del expediente): se elige una pregunta
frecuente o se escribe (5 a 1000 caracteres). Se guarda en `consultasDireccion` y Apps Script la
envía cada 5 minutos al correo del responsable, con copia y respuesta directa a quien preguntó,
y la deja en el historial del expediente. Si el responsable cambió antes del envío, se omite.
Reglas en `src/lib/management-panel.ts` e `src/lib/inquiry.ts`, con pruebas.

## Estados

Todo expediente nace en **Recibido** y avanza con el botón **Continuar** del detalle; el
formulario de edición no cambia el estado.

```
Flujo estándar:
Recibido → Asignado → En respuesta → Radicado de salida → Archivo (Finalizado)

Flujo de traslado (se elige en "En respuesta"):
… → En respuesta → Traslado por competencia → Generar radicado de traslado
  → Generar respuesta al ciudadano → Radicar respuesta → Archivo (Finalizado)
```

| Paso actual                    | Qué se exige para continuar                                                                                | Pasa a                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Recibido                       | Confirmar formato físico firmado y asociar el documento recibido (OneDrive)                                | Asignado                                                    |
| Asignado                       | Elegir responsable; se le envía un correo                                                                  | En respuesta                                                |
| En respuesta                   | Elegir: respuesta al usuario, traslado (destino y motivo) o cambio de responsable                          | Radicado de salida / Traslado por competencia / sigue igual |
| Radicado de salida             | Asociar la respuesta radicada y registrar número y fecha de radicado (envío y quién respondió, opcionales) | Archivo (Finalizado)                                        |
| Traslado por competencia       | —                                                                                                          | Generar radicado de traslado                                |
| Generar radicado de traslado   | Asociar el documento de traslado y registrar número y fecha de radicado                                    | Generar respuesta al ciudadano                              |
| Generar respuesta al ciudadano | —                                                                                                          | Radicar respuesta                                           |
| Radicar respuesta              | Asociar la respuesta radicada y registrar número y fecha de radicado                                       | Archivo (Finalizado)                                        |

Al llegar a **Archivo (Finalizado)** el expediente queda inactivo, guarda su `fechaCierre` y pasa
al Histórico en modo consulta. Un Administrador o Coordinador también puede **archivar** un
expediente activo desde la lista (estado `Archivado`); debe escribir el motivo, que queda en el
historial.

Cada número de radicado registrado en el flujo crea un documento en `radicados` (tipo `Salida` o
`Traslado`) y se guarda en el expediente como `numeroRadicadoActuacion`, sin reemplazar el
radicado de entrada. El radicado de entrada (`numeroRadicado`) no puede repetirse entre
expedientes.

**Formato de los radicados.** Los asigna Archivo: año + serie + consecutivo de 4 cifras (se
aceptan más). La serie es `100` para la entrada (`2026100xxxx`) y `200` para todo lo que se envía:
respuestas, traslados y ampliaciones (`2026200xxxx`). El año debe coincidir con la fecha del
radicado. Se valida al registrar o corregir un número (`src/lib/filing-number.ts`); los
radicados históricos con otro formato se conservan mientras no se cambien.

**Correspondencia interna.** La que llega de otra oficina de la Alcaldía se registra con la clase
**Interna** (campo `clase`; sin el campo, el expediente es externo). Su radicado de entrada tiene
numeración propia: año, guion y consecutivo de 6 cifras o más (`2026-000123`), con el año de la
fecha de radicado. Lo que se envía en un expediente interno (respuesta, traslado, ampliación)
acepta ese formato o la serie `200`. Los plazos, el flujo y los permisos son los mismos. En el
formulario, escribir un número con guion elige sola la clase Interna; el remitente (dependencia o
funcionario) es obligatorio y no se piden documento ni calidad del solicitante. Solo
Administrador y Coordinador cambian la clase de un expediente ya registrado, igual que el
radicado de entrada. Reglas en `src/lib/correspondence.ts` y `src/lib/filing-number.ts`, con
pruebas.

Estas reglas están en `src/lib/expedient-workflow.ts`, con una prueba por paso en
`expedient-workflow.test.ts`; el diálogo de actuación solo las muestra. Para cambiar el flujo se
modifica ese módulo y su prueba, y se actualiza esta tabla.

## Términos y semáforo

- `fechaLimite` = fecha de radicado + `diasRespuesta` del tipo de trámite + días ampliados,
  contando solo días hábiles: se excluyen sábados, domingos, los **festivos nacionales de
  Colombia** (calculados para cualquier año en `src/lib/colombian-holidays.ts`: Ley 51 de 1983 y
  fechas que dependen de la Pascua) y los **días adicionales sin atención** de Configuración.
- `diasRestantes` se recalcula cada vez que se consulta un expediente.
- `fechaLimite` se guarda al crear o editar el expediente. Si cambian las reglas del término (por
  ejemplo, los festivos), `npx tsx scripts/recalculate-deadlines.ts` lista los expedientes con una
  fecha límite distinta a la que corresponde y `--apply` los corrige, dejando nota en el historial.
- Semáforo (`estadoTermino`): **Vencido** si quedan menos de 0 días; **Próximo a vencer** si quedan
  hasta el umbral de **Configuración** (3 por defecto); **En plazo** en otro caso.
- La fecha de recibido es informativa y no afecta el término.

La lógica está en `src/lib/expedient-deadline.ts` y `src/lib/colombian-holidays.ts` (con pruebas)
y se repite en `google-apps-script/Code.gs` para las alertas; si cambia una, debe cambiar la otra.

## Ampliación del plazo

Parágrafo del art. 14 de la Ley 1437 de 2011, sustituido por la Ley 1755 de 2015: cuando no se
puede responder a tiempo, antes del vencimiento se informa al peticionario el motivo y el nuevo
plazo, que no puede exceder el doble del inicial. En el detalle, **Más acciones → Ampliar plazo** (quien puede
gestionar el expediente, mientras no esté vencido) exige:

| Dato                          | Regla                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Radicado escaneado (OneDrive) | Nombre y enlace institucional del oficio que comunica la ampliación                           |
| Número y fecha del radicado   | La fecha no puede ser futura, anterior a la radicación ni posterior a la fecha límite vigente |
| Días hábiles solicitados      | Entero ≥ 1; la suma de ampliaciones no supera 2 × el término inicial                          |
| Motivo                        | Obligatorio                                                                                   |

En un solo lote se guarda la nueva `fechaLimite` (días hábiles contados desde la fecha límite
anterior), `diasAmpliacion`, el detalle en `ampliacionesPlazo[]`, el escaneo como documento
`AMPLIACION_PLAZO`, el radicado (tipo `Ampliación de plazo`) y el historial. Las reglas están en
`src/lib/deadline-extension.ts` con sus pruebas; el tope está en `MAX_EXTENSION_FACTOR`.

## Apoyo en respuesta

Cuando parte de una petición la responde otra área (por ejemplo, un derecho de petición de
Catastro con un punto de Tesorería), el expediente **no cambia de área ni de responsable**: con
**Más acciones → Apoyo en respuesta** en el detalle se registra quién apoyó, de qué área y en qué (5 a 500
caracteres). Queda en el resumen, en el historial y en la columna "Apoyo de otras áreas" del
reporte. Si la persona tiene usuario, se suma a `participantes` y puede consultar el expediente,
pero no gestionarlo. Lo registra quien puede gestionar el expediente. Reglas en
`src/lib/response-support.ts`, con pruebas.

## Historial

La pestaña Historial muestra quién hizo qué y cuándo, agrupado por día, con el nombre y el rol de
cada persona ("SIGECAT · Automático" para lo que hacen los procesos). Se filtra por tipo
(trámite, radicados y plazos, documentos, correcciones, correos y preguntas, notas), se busca por
texto, se ordena de los más recientes a los más antiguos o al revés y se exporta a Excel. Las
ediciones muestran cada dato con su valor anterior y el nuevo; un correo que no se pudo enviar se
ve en rojo. Lógica en `src/lib/history-view.ts`, con pruebas.

Apps Script también escribe en el historial: cada correo de asignación y cada alerta de
vencimiento enviados, y los que no se pudieron enviar con el motivo.

Las entradas que se guardan juntas (por ejemplo, el radicado de la respuesta y el cierre) llevan
`orden` para mostrarse en la secuencia en que ocurrieron. Editar datos sin cambiar nada no se
guarda, para no llenar el historial de entradas vacías.

## Notas del historial

Para aclarar algo del expediente sin cambiarlo (por ejemplo, "el radicado de entrada se confirmó
con la planilla de Archivo"). **Agregar nota** en la pestaña Historial o en **Más acciones**; el
filtro **Notas** las muestra sin el resto, y se distinguen en color.

- Escriben notas Administrador y Coordinador en cualquier expediente, y el Funcionario en los que
  figura en `participantes`, aunque ya no los gestione y también cerrados. Directivo y Consulta
  no escriben.
- Texto de 5 a 1000 caracteres. Se guarda solo en el historial (acción `Nota`), sin tocar el
  expediente, con el autor y la fecha del servidor.
- No se editan ni se borran: para corregir una nota se agrega otra.

`firestore.rules` admite en el historial esa forma exacta (`isValidNote`) de quien puede leer el
expediente y es usuario operativo; el resto del historial sigue exigiendo poder gestionarlo.
Reglas en `src/lib/expedient-notes.ts`, con pruebas.

## Registro de actuaciones atrasadas

Para lo que se hizo a tiempo en la oficina (respuesta, traslado, ampliación) pero no se subió a
la aplicación. **Más acciones → Registrar atrasado** en el detalle (quien puede gestionar el expediente,
mientras esté activo); si el expediente aparece vencido, un aviso lo ofrece. También se abre con
`#/expedientes/{id}?registro=tardio`.

El asistente parte del paso en que quedó el expediente y pide, en el orden del flujo, solo lo
que falta:

| Sección    | Qué pide                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Situación  | Qué pasó (se respondió, se trasladó o sigue en trámite), si se amplió el plazo y por qué no se registró a tiempo (obligatorio)            |
| Recepción  | Si quedó en Recibido o Asignado: documento recibido (si falta), firma del formato y responsable                                           |
| Ampliación | Oficio radicado, días hábiles y motivo. Debe haberse radicado **a más tardar el día del vencimiento vigente**; si fue después, no procede |
| Radicados  | Traslado (destino, motivo, radicado) y/o respuesta: número, **fecha de radicado** y **fecha de envío**, escaneo y quién proyectó y firmó  |
| Revisión   | Línea de tiempo con las fechas reales y si cada actuación quedó dentro del término; estado en que quedará                                 |

Reglas (`src/lib/late-registration.ts`, con pruebas):

- Las fechas no pueden ser anteriores a la radicación ni futuras; el envío no es anterior a su
  radicado; la respuesta al ciudadano no es anterior al traslado ni la respuesta a la ampliación.
  Los números son distintos entre sí y del radicado de entrada.
- Si ya hay un documento asociado del tipo (por ejemplo, la respuesta subida sin terminar el
  paso), sirve de soporte y no se pide de nuevo.
- Una respuesta fuera del término se registra igual, con los días hábiles de retraso. Un traslado
  después de 5 días hábiles (art. 21, Ley 1755 de 2015) se advierte sin bloquear.
- Si respondió **otro compañero**, el expediente queda a su nombre y el historial lo dice. El
  mismo selector está en los pasos con radicado del flujo normal.
- Al finalizar, `fechaCierre` es la fecha real del radicado de respuesta.

Todo se guarda en un solo lote: campos y estado, documentos, ampliación y nueva fecha límite,
radicados (marcados `registroTardio`), historial en orden y `registrosTardios[]` con el motivo.

**Oportunidad:** el detalle y Reportes miden si se respondió a tiempo con la fecha del radicado
de la respuesta (`fechaRadicadoActuacion`), no con el día en que se cerró en la aplicación; sin
ese dato, con la fecha de cierre.

## Correcciones (Administrador y Coordinador)

- **Datos del expediente:** botón **Editar datos** en el detalle, también si el expediente ya está
  cerrado. El estado del flujo no cambia. El historial dice qué dato cambió, con el valor anterior y
  el nuevo; asunto, observaciones y datos de contacto solo se nombran
  (`src/lib/expedient-changes.ts`). Si cambia el radicado de entrada, también se actualiza su copia
  en cada radicado de Radicación.
- **Radicado de entrada:** identifica el expediente y es el que se muestra en todos los
  encabezados. Solo Administrador y Coordinador lo corrigen (también en `firestore.rules`), y
  nunca por un radicado de respuesta, traslado o ampliación del mismo expediente. Si ya se
  reemplazó, el detalle muestra un aviso y sugiere el número del documento recibido
  (`src/lib/entry-filing.ts`).
- **Radicados** de salida, traslado y ampliación: número y fecha, desde Radicación o desde el
  resumen del expediente. Como el id del radicado incluye el número, un número nuevo crea otro
  documento y borra el anterior; en el mismo lote se actualizan el radicado de la actuación, los
  documentos y las ampliaciones que lo mencionan (`src/lib/record-corrections.ts`).
- **Documentos asociados:** nombre, enlace y folios, desde la pestaña Documentos.

Toda corrección queda en el historial con el valor anterior y el nuevo.

## Hoja de control

La pestaña Documentos lista los documentos en orden cronológico con foliación consecutiva (si se
registran los folios) e imprime la hoja de control del expediente.

## Calendario y recordatorios

Página **Calendario** (`#/calendario`, todos los roles). Cada persona ve su mes, de lunes a
domingo:

- **Vencimientos:** la `fechaLimite` de los expedientes que tiene asignados en trámite y de los
  que respondió. No se guarda nada aparte: se consulta por `participantes` y `fechaLimite` (índice
  compuesto). Colores del semáforo (en plazo, próximo a vencer, vencido) y, si ya se respondió,
  azul a tiempo o gris fuera de término. Los archivados sin respuesta no aparecen.
- **Recordatorios:** colección `recordatorios`, un documento por destinatario (los de un mismo
  envío comparten `grupo`): título (3 a 120), detalle opcional (hasta 1000), día, y hasta 5
  enlaces de OneDrive institucional. Cada quien se los crea a sí mismo; Administrador y
  Coordinador también a cualquier persona activa, o a todo el equipo. Quien lo recibe lo marca
  como hecho; quien lo creó (o un Administrador) lo elimina.
- **Tareas de Mi agenda** con fecha, solo en el calendario propio.

Administrador y Coordinador eligen de quién ver el calendario y tienen la lista de los
recordatorios que crearon, con el estado del correo y si ya se hicieron. Reglas en
`firestore.rules` (con pruebas) y en `src/lib/calendar.ts` y `src/lib/reminders.ts`.

## Correos

Los envía Google Apps Script desde la cuenta de Google que lo ejecuta. La aplicación nunca envía correos ni
decide su destinatario o contenido: solo deja una solicitud con identificadores.

| Correo                   | Cuándo                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asignación               | Al asignar o reasignar un expediente; se procesa cada 5 minutos                                                                                                      |
| Alerta de vencimiento    | Diario a las 8 a. m., a responsables con alertas activas, cuando quedan entre 0 y el umbral de días; una vez por responsable y fecha límite                          |
| Pregunta de la dirección | Al preguntar desde el Panel de dirección o el detalle; se procesa cada 5 minutos. Responder el correo le llega a quien preguntó                                      |
| Recordatorio             | Si lo creó otra persona, un aviso al asignarlo (en máximo 5 minutos); y el día, desde las 7 a. m. Si es para hoy, un solo correo. Responder le llega a quien lo creó |
| Prueba                   | Desde Configuración, solo administradores                                                                                                                            |

La instalación del script está en el README.
