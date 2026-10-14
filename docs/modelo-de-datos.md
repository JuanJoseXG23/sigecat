# Modelo de datos (Firestore)

Los tipos de TypeScript de `src/types/` son la referencia exacta; aquí se resume qué guarda cada
colección y quién puede escribir en ella según `firestore.rules`.

## `usuarios/{uid}`

El id del documento es el uid de Firebase Authentication.

| Campo                                               | Descripción                                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `nombreCompleto`, `correo`, `cargo`, `dependencia?` | Datos de la persona. `dependencia` es el id del área (`src/lib/dependencies.ts`); los perfiles antiguos pueden tener el nombre escrito a mano |
| `rol`                                               | `Administrador`, `Coordinador`, `Funcionario`, `Directivo` o `Consulta`                                                                       |
| `activo`                                            | Si es `false`, la sesión se cierra al entrar                                                                                                  |
| `recibeAlertasVencimiento?`                         | Recibe alertas diarias de vencimiento                                                                                                         |
| `fechaCreacion`, `ultimoIngreso`                    | Fechas                                                                                                                                        |

Escriben: el Administrador; cada usuario solo actualiza su propio `ultimoIngreso`.
Leen: el Administrador; cada usuario lee solo su propio perfil.

## `directorioUsuarios/{uid}`

Copia mínima de cada perfil (`uid`, `nombreCompleto`, `rol`, `activo`, `dependencia?`) que cualquier sesión
activa puede leer para elegir o filtrar responsables, sin exponer correos ni cargos. El
Administrador la escribe en el mismo lote que el perfil; los scripts `user:create` y `seed`
también la actualizan. Si se edita un perfil desde la consola de Firebase, se resincroniza con
`npm run users:sync-directory`.

## `expedientes/{id}`

| Campo                                                                          | Descripción                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dependencia?`                                                                 | Área que lidera el expediente (id de `src/lib/dependencies.ts`). Sin el campo, es de Catastro                                                                                        |
| `participantes[]?`                                                             | uid de quienes lo registraron, lo tuvieron asignado o actuaron sobre él. Solo crece (`arrayUnion` en cada escritura)                                                                 |
| `numeroRadicado`                                                               | Radicado de entrada; único                                                                                                                                                           |
| `fechaRadicado`, `fechaRecibido?`, `medioIngreso?`                             | Datos de recepción                                                                                                                                                                   |
| `tipoTramiteId`, `tipoTramite`                                                 | Tipo de trámite y su nombre al momento de guardar                                                                                                                                    |
| `asunto?`                                                                      | Resumen de la petición                                                                                                                                                               |
| `diasTermino?`, `diasAmpliacion?`, `ampliacionesPlazo[]?`                      | Término inicial, días ampliados y detalle de cada ampliación (radicado, días, motivo, fechas límite)                                                                                 |
| `solicitantes[]`                                                               | `nombre`, `documento`, `telefono`, `correo`, `tipoSolicitante`                                                                                                                       |
| `predios[]?`                                                                   | Opcional: `municipio`, `numeroPredial`, `matriculaInmobiliaria`, `direccion`. Los nuevos empiezan sin predio; los antiguos pueden tener uno con solo el municipio, que no se muestra |
| `estado`                                                                       | Ver [flujo-y-permisos.md](flujo-y-permisos.md)                                                                                                                                       |
| `prioridad?`                                                                   | `Alta`, `Media` o `Baja`                                                                                                                                                             |
| `funcionarioAsignado?`                                                         | `{ uid, nombreCompleto }`                                                                                                                                                            |
| `responsableExterno?`, `trasladoPorCompetencia?`                               | Dependencia destino de un traslado                                                                                                                                                   |
| `fechaLimite`, `diasRestantes`, `diasVencidos`, `estadoTermino`                | Término (se recalcula al leer)                                                                                                                                                       |
| `documentosWorkflow[]`                                                         | Enlaces de OneDrive: `tipo` (`RECIBIDO`, `RADICADO_SALIDA`, `TRASLADO`, `AMPLIACION_PLAZO`), `nombre`, `url`, `usuario`, `fecha`, `folios?`                                          |
| `formatoFisicoFirmado?`, `numeroRadicadoActuacion?`, `fechaRadicadoActuacion?` | Datos de las actuaciones                                                                                                                                                             |
| `fechaEnvioActuacion?`, `registrosTardios[]?`                                  | Fecha de envío del último radicado; registros tardíos (`motivo`, `usuario`, `fecha`)                                                                                                 |
| `apoyosRespuesta[]?`                                                           | Apoyo de otras áreas: `dependencia`, `persona`, `personaUid?`, `descripcion`, `usuario`, `fecha`                                                                                     |
| `ultimaAlertaVencimiento?`                                                     | Lo escribe solo Apps Script para no repetir alertas                                                                                                                                  |
| `activo`                                                                       | `false` cuando está finalizado o archivado                                                                                                                                           |
| `creadoPor`, `fechaCreacion`, `fechaActualizacion`                             | Auditoría; los dos primeros son inmutables                                                                                                                                           |
| `fechaCierre?`                                                                 | Al finalizar o archivar (en un registro tardío, la fecha real de la respuesta). Los cerrados antes de este campo usan `fechaActualizacion`                                           |

Subcolección **`historial`**: `usuario`, `accion`, `detalle`, `fecha`. Solo se agregan registros;
nunca se editan ni se borran.

Leen: Administrador, Coordinador, Directivo y Consulta, todos; el Funcionario, solo los que
tienen su uid en `participantes` (sus consultas deben filtrar por ese campo; el historial y los
radicados siguen a su expediente). Escriben: usuarios operativos según
[los permisos](flujo-y-permisos.md#roles). Nadie puede borrar expedientes.

## `radicadosEntrada/{numero}`

Índice que hace único el radicado de entrada: `{ expedienteId }`. Se crea en el mismo lote que
el expediente, y las reglas exigen que exista y apunte al expediente; como un Funcionario no puede
consultar expedientes ajenos, es la única forma de comprobar que el número no se repite. Al
corregir el radicado de entrada se crea el nuevo y se borra el anterior. Nadie lo lista; cualquier
sesión activa puede consultar un número.

## `radicados/{expedienteId}_{numero}`

Radicados de salida, traslado y ampliación de plazo registrados en el flujo: `numero`, `fecha`,
`tipo`, `expedienteId`, `expedienteRadicado?`, `solicitante`, `responsable`, `estado`, `municipio?` (solo en los antiguos), `observaciones`,
`documentoUrl?`, `documentoNombre?`, `fechaEnvio?`, `registroTardio?`. El id evita registrar dos veces el mismo número en un
expediente. Administrador y Coordinador corrigen `fecha` (con `editadoPor` y `fechaEdicion`);
un número corregido es un documento nuevo y el anterior se borra.

## `tiposTramite/{id}`

`nombre`, `descripcion`, `diasRespuesta`, `flujoEstados`, `activo`, los indicadores
informativos `requiereVisita` y `requiereRevisionJuridica`. Solo el Administrador escribe; se
desactivan en vez de borrarse.

## `configuracion/reglasNegocio`

`diasFestivos[]` (`yyyy-mm-dd`: días adicionales sin atención; los festivos nacionales se
calculan solos), `umbralProximoVencer`, `alertasCorreoHabilitadas`. Solo el
Administrador escribe.

## `tareas/{id}`

Tareas personales de **Mi Agenda**: `titulo`, `descripcion?`, `prioridad`, `estado`
(`Pendientes`, `En proceso`, `Por revisar`, `Finalizadas`), `fechaLimite?`, `anexos[]` (enlaces de
OneDrive), `expedienteId?` y `expedienteRadicado?` (expediente relacionado), `responsableId`. Cada usuario solo ve y modifica las suyas.

## Colas de correo

Las crea la aplicación y las procesa Apps Script, que marca `estado` como `Enviado`, `Error` u
`Omitido` y agrega `fechaProcesamiento` y `detalleError?`.

- **`notificacionesAsignacion`**: `expedienteId`, `destinatarioUid`, `solicitadoPor`, `estado`,
  `fechaSolicitud`. Las reglas exigen que el destinatario sea el responsable del expediente.
- **`consultasDireccion`**: `expedienteId`, `expedienteRadicado`, `destinatarioUid`,
  `destinatarioNombre`, `solicitadoPor`, `pregunta`, `estado`, `fechaSolicitud`. Las reglas
  exigen que el destinatario sea el responsable del expediente y que quien pregunta sea
  Directivo, Coordinador o Administrador; cada quien lee solo sus preguntas.
- **`solicitudesPruebaCorreo`**: correo de prueba; solo administradores.
