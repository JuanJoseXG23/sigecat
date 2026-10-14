# Registro de decisiones

Decisiones de producto y arquitectura para llevar SIGECAT a toda la Secretaría de Hacienda y
Desarrollo Económico. "Delegada" significa que el responsable del producto pidió aplicar la
recomendación técnica; se puede revisar.

## Institución y alcance

| ID   | Decisión                                                                                                    | Estado     |
| ---- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| D-01 | Entidad: Alcaldía de Girardota. Alcance: solo la Secretaría de Hacienda y Desarrollo Económico              | Confirmada |
| D-02 | Áreas: Catastro, Cobro coactivo, Impuestos, Fiscalización, Contabilidad, Tesorería y Presupuesto            | Confirmada |
| D-03 | Las otras áreas manejan la misma documentación con el mismo tratamiento: se generaliza el expediente actual | Confirmada |
| D-06 | Se mantiene el nombre SIGECAT y su URL; reemplaza la indicación inicial de no usarlo para la plataforma     | Confirmada |
| D-08 | Plan gratuito de Firebase, proyecto a nombre del responsable; uso interno, sin certificaciones              | Confirmada |
| D-09 | En uso real; hasta 50 expedientes diarios y hasta 20 usuarios activos                                       | Confirmada |

## Radicados

| ID   | Decisión                                                                                                     | Estado     |
| ---- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| D-04 | Archivo asigna todos los radicados; SIGECAT solo los registra. Archivo no usa SIGECAT (D-20)                 | Confirmada |
| D-05 | Entrada: año + 100 + consecutivo. Todo lo enviado (respuesta, traslado, ampliación): año + 200 + consecutivo | Confirmada |
| D-21 | El año es el de la fecha de radicado; se valida en lo nuevo o corregido                                      | Confirmada |
| D-30 | El consecutivo se acepta con 4 cifras o más                                                                  | Delegada   |

## Usuarios, áreas y permisos

| ID   | Decisión                                                                                                                                     | Estado     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D-07 | El Funcionario ve y responde lo que se le asigna o pasó por él; los usuarios mayores ven todo                                                | Confirmada |
| D-11 | Ven todo: Administrador, Coordinador y Directivo                                                                                             | Confirmada |
| D-12 | No hay coordinadores por área. Jefatura: Diana. Coordinan la documentación: Juan José y Emanuel                                              | Confirmada |
| D-13 | El funcionario asignado registra todo en SIGECAT                                                                                             | Confirmada |
| D-14 | Quien registra un expediente cuenta como alguien por quien pasó                                                                              | Confirmada |
| D-15 | Los expedientes sin responsable los ven los usuarios mayores y quien los registró                                                            | Confirmada |
| D-16 | Los Funcionarios de Catastro dejan de ver los expedientes de sus compañeros                                                                  | Confirmada |
| D-17 | Un expediente puede cambiar de área o tener respuestas compartidas                                                                           | Confirmada |
| D-18 | Cada funcionario pertenece a una sola área                                                                                                   | Confirmada |
| D-19 | Todos los expedientes existentes son de Catastro                                                                                             | Confirmada |
| D-23 | Consulta ve todo en lectura                                                                                                                  | Delegada   |
| D-24 | Los coordinadores coordinan la documentación de toda la Secretaría                                                                           | Delegada   |
| D-25 | Diana: Directivo. Juan José: Administrador                                                                                                   | Delegada   |
| D-26 | El expediente queda asignado a quien lo registra si no elige otro responsable                                                                | Delegada   |
| D-27 | Respuesta compartida: un área lidera y responde; las demás colaboran                                                                         | Delegada   |
| D-28 | ~~Pasar expedientes entre áreas~~: reemplazada por D-34                                                                                      | Descartada |
| D-29 | Los tipos de trámite son comunes a todas las áreas                                                                                           | Delegada   |
| D-31 | Solo actúa el responsable actual; quienes lo tuvieron antes solo consultan                                                                   | Delegada   |
| D-32 | Catálogo de áreas fijo en el código (`src/lib/dependencies.ts`)                                                                              | Delegada   |
| D-33 | Los Funcionarios ven en Radicación solo los radicados de sus expedientes                                                                     | Delegada   |
| D-34 | Apoyo en respuesta: se registra quién de otra área apoyó y en qué; el expediente no cambia de área ni de responsable                         | Confirmada |
| D-37 | Notas en el historial: las dejan supervisores y quien figura en el expediente, también cerrado; no se editan ni borran                       | Confirmada |
| D-38 | Calendario por persona: vencimientos desde la fecha límite (sin datos nuevos) y recordatorios con correo; los supervisores los crean a otros | Confirmada |

## Predios

| ID   | Decisión                                                                                                 | Estado |
| ---- | -------------------------------------------------------------------------------------------------------- | ------ |
| D-10 | Predios opcionales en los expedientes nuevos; los históricos se conservan; se quita la columna Municipio | Hecha  |

## Copias y recuperación

| ID   | Decisión                                                                                                                                            | Estado   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D-35 | Copia diaria automática en Drive como respaldo principal; copia manual mensual fuera de la nube; sin copias por correo (llevarían datos personales) | Delegada |
| D-36 | Simulacro de recuperación cada tres meses con `npm run drill`                                                                                       | Delegada |

## Pendientes

Del responsable de SIGECAT (requieren su sesión en Google o Firebase):

- Propiedad institucional del proyecto de Firebase, del Apps Script y del repositorio: crear una
  cuenta de Google con un correo `@girardota.gov.co` (la Alcaldía usa Outlook), hacerla
  propietaria y aceptar desde ella los términos de tratamiento de datos de Google.
- Protección contra eliminación de la base de Firestore (desactivada; la llave no puede cambiarla).
- Llaves de administración: eliminar la `f5cf8f1658…` (archivo en Descargas, no la usa SIGECAT) y
  reemplazar la `e7aa6580bb…` de `secrets/` por una nueva guardada fuera de OneDrive.

Con datos del responsable:

- Usuarios de las otras áreas: nombre, correo, cargo y área (`npm run user:create`).
- Radicado de respuesta de `20261004715` registrado como `202620047155` (12 cifras): revisar en
  el físico y corregir desde Radicación.
- Confirmar con el físico o la planilla de Archivo los diez radicados de entrada corregidos el 14
  de octubre de 2026 (abajo, en Hecho).
- `20262007648` figura como respuesta de dos expedientes (`20261006795`, Rosmelina Echeverri, y
  `20261006899`, Ligia Janeth Quintero): uno está mal. Revisar en el físico y corregir desde
  Radicación. Para evitarlo, se recomienda un índice de radicados de salida únicos, como el de
  entrada.
- `20261004908`: la respuesta `20262005217` figura en Radicación del 23 de julio y en el expediente
  del 21 de julio. Confirmar la fecha real.
- Tipos de solicitante "Propietario" y "Copropietario": ¿se mantienen para todas las áreas?
- D-26: hoy el formulario permite dejar el expediente sin responsable; falta decidir si se asigna
  solo a quien lo registra.

De otras dependencias: acciones de cumplimiento normativo (RNBD, aviso de privacidad, Ley 1712,
constancia con Archivo, MSPI), ver [cumplimiento-normativo.md](cumplimiento-normativo.md).

Hecho: copia diaria en Drive activa desde el 14 de octubre de 2026 (`setupDailyBackup`). Usuario de
Emanuel (Coordinador, como John) creado el 14 de octubre de 2026.

Hecho el 14 de octubre de 2026: diez radicados de entrada inválidos corregidos a `2026100` + el
consecutivo del documento recibido (`DP` + consecutivo; los consecutivos crecen con las fechas).
Seis tenían el radicado de su respuesta (serie 200) y cuatro el texto `DP####` que dejó
`fix-entry-filings` el 2 de octubre: `20262004715` → `20261004715`, `20262005217` →
`20261004908`, `20262005274` → `20261005056`, `20262005337` → `20261005144`, `20262006102` →
`20261005552`, `20262006858` → `20261006033`, y `DP6480`, `DP6589`, `DP6677`, `DP6795` →
`20261006480`, `20261006589`, `20261006677`, `20261006795`. Cada uno tiene nota en su historial;
el estado anterior quedó en `C:\Users\juanj\copias-sigecat`. `2001007448` ya estaba como
`20261007448`.

Hecho el 14 de octubre de 2026, en la depuración general (estado anterior en la misma carpeta):
fecha de cierre de 14 expedientes, que la migración del 13 de octubre había tomado de un
mantenimiento (ahora es la de "Finalizó expediente"); radicado de entrada en 9 registros de
Radicación que no lo tenían; número de la actuación radicada en 16 expedientes anteriores a que se
guardara.
