# Modelo de datos (Firestore)

Los tipos de TypeScript de `src/types/` son la referencia exacta; aquí se resume qué guarda cada
colección y quién puede escribir en ella según `firestore.rules`.

## `usuarios/{uid}`

El id del documento es el uid de Firebase Authentication.

| Campo                                               | Descripción                                                |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `nombreCompleto`, `correo`, `cargo`, `dependencia?` | Datos de la persona                                        |
| `rol`                                               | `Administrador`, `Coordinador`, `Funcionario` o `Consulta` |
| `activo`                                            | Si es `false`, la sesión se cierra al entrar               |
| `recibeAlertasVencimiento?`                         | Recibe alertas diarias de vencimiento                      |
| `fechaCreacion`, `ultimoIngreso`                    | Fechas                                                     |

Escriben: el Administrador; cada usuario solo actualiza su propio `ultimoIngreso`.
Leen: el Administrador; cada usuario lee solo su propio perfil.

## `directorioUsuarios/{uid}`

Copia mínima de cada perfil (`uid`, `nombreCompleto`, `rol`, `activo`) que cualquier sesión
activa puede leer para elegir o filtrar responsables, sin exponer correos ni cargos. El
Administrador la escribe en el mismo lote que el perfil; los scripts `user:create` y `seed`
también la actualizan. Si se edita un perfil desde la consola de Firebase, se resincroniza con
`npm run users:sync-directory`.

## `expedientes/{id}`

| Campo                                                                          | Descripción                                                                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `numeroRadicado`                                                               | Radicado de entrada; único                                                                                                                  |
| `fechaRadicado`, `fechaRecibido?`, `medioIngreso?`                             | Datos de recepción                                                                                                                          |
| `tipoTramiteId`, `tipoTramite`                                                 | Tipo de trámite y su nombre al momento de guardar                                                                                           |
| `asunto?`, `nivelAcceso?`                                                      | Resumen de la petición; `Pública`, `Pública clasificada` o `Pública reservada`                                                              |
| `diasTermino?`, `diasAmpliacion?`, `ampliacionesPlazo[]?`                      | Término inicial, días ampliados y detalle de cada ampliación (radicado, días, motivo, fechas límite)                                        |
| `clasificacionDocumental?`                                                     | Copia de la TRD del trámite: `codigo`, `serie`, `subserie`, `retencionGestion`, `retencionCentral`, `disposicionFinal`                      |
| `solicitantes[]`                                                               | `nombre`, `documento`, `telefono`, `correo`, `tipoSolicitante`                                                                              |
| `predios[]`                                                                    | `municipio`, `numeroPredial`, `matriculaInmobiliaria`, `direccion`                                                                          |
| `estado`                                                                       | Ver [flujo-y-permisos.md](flujo-y-permisos.md)                                                                                              |
| `prioridad?`                                                                   | `Alta`, `Media` o `Baja`                                                                                                                    |
| `funcionarioAsignado?`                                                         | `{ uid, nombreCompleto }`                                                                                                                   |
| `responsableExterno?`, `trasladoPorCompetencia?`                               | Dependencia destino de un traslado                                                                                                          |
| `fechaLimite`, `diasRestantes`, `diasVencidos`, `estadoTermino`                | Término (se recalcula al leer)                                                                                                              |
| `documentosWorkflow[]`                                                         | Enlaces de OneDrive: `tipo` (`RECIBIDO`, `RADICADO_SALIDA`, `TRASLADO`, `AMPLIACION_PLAZO`), `nombre`, `url`, `usuario`, `fecha`, `folios?` |
| `formatoFisicoFirmado?`, `numeroRadicadoActuacion?`, `fechaRadicadoActuacion?` | Datos de las actuaciones                                                                                                                    |
| `ultimaAlertaVencimiento?`                                                     | Lo escribe solo Apps Script para no repetir alertas                                                                                         |
| `activo`                                                                       | `false` cuando está finalizado o archivado                                                                                                  |
| `creadoPor`, `fechaCreacion`, `fechaActualizacion`                             | Auditoría; los dos primeros son inmutables                                                                                                  |
| `fechaCierre?`                                                                 | Al finalizar o archivar; inicia la retención. Los cerrados antes de este campo usan `fechaActualizacion`                                    |

Subcolección **`historial`**: `usuario`, `accion`, `detalle`, `fecha`. Solo se agregan registros;
nunca se editan ni se borran.

Escriben: usuarios operativos según [los permisos](flujo-y-permisos.md#roles). Nadie puede
borrar expedientes.

## `radicados/{expedienteId}_{numero}`

Radicados de salida, traslado y ampliación de plazo registrados en el flujo: `numero`, `fecha`,
`tipo`, `expedienteId`, `expedienteRadicado?`, `solicitante`, `responsable`, `estado`, `municipio`, `observaciones`,
`documentoUrl?`, `documentoNombre?`. El id evita registrar dos veces el mismo número en un
expediente. Se crean pero no se editan.

## `tiposTramite/{id}`

`nombre`, `descripcion`, `diasRespuesta`, `flujoEstados`, `activo`, los indicadores
informativos `requiereVisita` y `requiereRevisionJuridica`, y los campos opcionales de la TRD:
`codigoTRD`, `serie`, `subserie`, `retencionGestion`, `retencionCentral`, `disposicionFinal`. Solo el Administrador escribe; se
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
- **`solicitudesPruebaCorreo`**: correo de prueba; solo administradores.
