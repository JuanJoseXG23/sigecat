# Flujo del expediente y permisos

## Roles

| Rol           | Puede                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| Administrador | Todo: usuarios, tipos de trámite, configuración, reportes; modificar expedientes finalizados |
| Coordinador   | Gestionar y archivar cualquier expediente activo; ver reportes                               |
| Funcionario   | Crear expedientes y gestionar los que no tienen responsable o le están asignados             |
| Consulta      | Ver dashboard, expedientes, biblioteca e histórico; no modifica nada                         |

Menú por rol (definido en `src/routes/navigation.ts`):

| Sección                                       | Admin | Coord. | Func. | Consulta |
| --------------------------------------------- | :---: | :----: | :---: | :------: |
| Dashboard, Expedientes, Biblioteca, Histórico |   ✓   |   ✓    |   ✓   |    ✓     |
| Mi Agenda, Radicación                         |   ✓   |   ✓    |   ✓   |          |
| Reportes                                      |   ✓   |   ✓    |       |          |
| Usuarios, Tipos de trámite, Configuración     |   ✓   |        |       |          |

Los usuarios se crean con `npm run user:create` (ver README); la página Usuarios permite editar
datos, rol y activar o desactivar cuentas.

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

| Paso actual                    | Qué se exige para continuar                                                       | Pasa a                                                      |
| ------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Recibido                       | Confirmar formato físico firmado y asociar el documento recibido (OneDrive)       | Asignado                                                    |
| Asignado                       | Elegir responsable; se le envía un correo                                         | En respuesta                                                |
| En respuesta                   | Elegir: respuesta al usuario, traslado (destino y motivo) o cambio de responsable | Radicado de salida / Traslado por competencia / sigue igual |
| Radicado de salida             | Asociar la respuesta radicada y registrar número y fecha de radicado              | Archivo (Finalizado)                                        |
| Traslado por competencia       | —                                                                                 | Generar radicado de traslado                                |
| Generar radicado de traslado   | Asociar el documento de traslado y registrar número y fecha de radicado           | Generar respuesta al ciudadano                              |
| Generar respuesta al ciudadano | —                                                                                 | Radicar respuesta                                           |
| Radicar respuesta              | Asociar la respuesta radicada y registrar número y fecha de radicado              | Archivo (Finalizado)                                        |

Al llegar a **Archivo (Finalizado)** el expediente queda inactivo, guarda su `fechaCierre` y pasa
al Histórico en modo consulta. Un Administrador o Coordinador también puede **archivar** un
expediente activo desde la lista (estado `Archivado`); debe escribir el motivo, que queda en el
historial.

Cada número de radicado registrado en el flujo crea un documento en `radicados` (tipo `Salida` o
`Traslado`) y se guarda en el expediente como `numeroRadicadoActuacion`, sin reemplazar el
radicado de entrada. El radicado de entrada (`numeroRadicado`) no puede repetirse entre
expedientes.

Estas reglas están en `src/lib/expedient-workflow.ts`, con una prueba por paso en
`expedient-workflow.test.ts`; el diálogo de actuación solo las muestra. Para cambiar el flujo se
modifica ese módulo y su prueba, y se actualiza esta tabla.

## Términos y semáforo

- `fechaLimite` = fecha de radicado + `diasRespuesta` del tipo de trámite + días ampliados,
  contando solo días hábiles: se excluyen sábados, domingos, los **festivos nacionales de
  Colombia** (calculados para cualquier año en `src/lib/colombian-holidays.ts`: Ley 51 de 1983 y
  fechas que dependen de la Pascua) y los **días adicionales sin atención** de Configuración.
- `diasRestantes` se recalcula cada vez que se consulta un expediente.
- Semáforo (`estadoTermino`): **Vencido** si quedan menos de 0 días; **Próximo a vencer** si quedan
  hasta el umbral de **Configuración** (3 por defecto); **En plazo** en otro caso.
- La fecha de recibido es informativa y no afecta el término.

La lógica está en `src/lib/expedient-deadline.ts` y `src/lib/colombian-holidays.ts` (con pruebas)
y se repite en `google-apps-script/Code.gs` para las alertas; si cambia una, debe cambiar la otra.

## Ampliación del plazo

Parágrafo del art. 14 de la Ley 1437 de 2011, sustituido por la Ley 1755 de 2015: cuando no se
puede responder a tiempo, antes del vencimiento se informa al peticionario el motivo y el nuevo
plazo, que no puede exceder el doble del inicial. En el detalle, **Ampliar plazo** (quien puede
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

## Gestión documental

- **Tabla de Retención Documental.** Cada tipo de trámite registra código, serie, subserie, años
  en archivo de gestión (AG) y central (AC) y disposición final. Se copian al expediente al
  crearlo (`clasificacionDocumental`).
- **Retención.** Histórico calcula la fase de cada expediente cerrado desde su `fechaCierre`
  (`src/lib/retention.ts`): en archivo de gestión, listo para transferencia primaria o para
  aplicar la disposición final. Exporta el inventario con las columnas del FUID.
- **Hoja de control e índice.** La pestaña Documentos del expediente lista los documentos en
  orden cronológico con foliación consecutiva (si se registran los folios) e imprime la hoja de
  control.
- **Nivel de acceso** (Ley 1712 de 2014): pública, pública clasificada (por defecto, por los datos
  personales) o pública reservada.

## Correos

Los envía Google Apps Script desde la cuenta institucional. La aplicación nunca envía correos ni
decide su destinatario o contenido: solo deja una solicitud con identificadores.

| Correo                | Cuándo                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Asignación            | Al asignar o reasignar un expediente; se procesa cada 5 minutos                                                                             |
| Alerta de vencimiento | Diario a las 8 a. m., a responsables con alertas activas, cuando quedan entre 0 y el umbral de días; una vez por responsable y fecha límite |
| Prueba                | Desde Configuración, solo administradores                                                                                                   |

La instalación del script está en el README.
