# Correspondencia interna y transferencia a otra dependencia

Fecha: 27 de octubre de 2026. Estado: borrador para aprobación.

Dos cambios independientes al expediente de SIGECAT. Se pueden construir y publicar por separado
(primero la correspondencia interna).

## Por qué

1. **Correspondencia interna.** Algunas peticiones no llegan de un ciudadano por Archivo sino de
   otra oficina de la Alcaldía. Se manejan con los mismos términos, pero su radicado tiene otra
   forma (`2026-xxxxxx`) y hoy SIGECAT lo rechaza porque solo acepta `año + 100 + consecutivo`.
2. **Transferencia a otra dependencia.** Cuando un expediente se manda a otra área o secretaría
   para que lo atienda allá, hoy se pierde la traza: o queda abierto en Catastro, o se archiva sin
   que conste a dónde fue. Se quiere cerrarlo dejando constancia de cuándo, a dónde y por qué se
   transfirió.

## Objetivos

- Registrar correspondencia interna con su propio formato de radicado, con los mismos plazos,
  semáforo, alertas, flujo y permisos que la externa.
- Distinguir interna y externa en listas, detalle, Radicación, filtros y reportes.
- Una acción ocasional, fácil de encontrar, que cierre el expediente como **Transferido** con la
  traza completa.

## No objetivos

- No cambia el **traslado por competencia** actual (sus cuatro pasos siguen iguales).
- La transferencia **no crea** un expediente en el área destino ni lo enlaza (decisión: opción A).
- No se reabre un expediente transferido (hoy ningún cierre se reabre).
- No se migran datos: los expedientes existentes son externos.
- No se toca Apps Script (ver Restricciones).

## Antiobjetivos

- Que un expediente transferido cuente como "respondido" (a tiempo o tarde) en el Panel de
  dirección o en Reportes: inflaría o hundiría el porcentaje de oportunidad.
- Que la transferencia estorbe en el flujo normal o se confunda con el traslado por competencia.
- Que interna y externa compartan numeración: son series separadas.

## Restricciones

- Plan gratuito de Firestore: ninguna pantalla puede leer más documentos que hoy. Los filtros
  nuevos se aplican sobre lo ya descargado.
- Permisos duplicados a propósito: cada regla nueva va en `src/lib/` (interfaz) y en
  `firestore.rules` (servidor), con pruebas en ambos lados.
- Escrituras atómicas: la transferencia se guarda en un solo `writeBatch` con su historial.
- Apps Script consulta solo expedientes con `activo == true`; un transferido deja de recibir
  alertas sin cambiar `Code.gs`. La copia de seguridad copia todos los campos.

## Enfoques considerados

**Correspondencia interna: cómo se sabe que un expediente es interno.**

| Enfoque                                        | Ventaja                                   | Costo                                                                                 |
| ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| **A. Campo propio en el expediente** (elegido) | Explícito, filtrable, validable en reglas | Un selector más en el formulario (se autollena)                                       |
| B. Marca en el tipo de trámite                 | Nada nuevo en el formulario               | Un mismo trámite puede llegar de las dos formas; cambiar la marca cambia el pasado    |
| C. Deducirlo del formato del número            | Sin campo                                 | Filtros y reportes deducen cada vez; un número mal escrito cae en la clase equivocada |

Elegido A por el responsable del producto.

**Transferencia: cómo se cierra.**

| Enfoque                                  | Ventaja                                      | Costo                                                    |
| ---------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| **Estado nuevo `Transferido`** (elegido) | Se distingue en Histórico, Reportes y reglas | Un valor más en `EXPEDIENT_STATUSES` y en las reglas     |
| Reutilizar `Archivado` con un motivo     | Sin estado nuevo                             | Archivar es solo de supervisores; Reportes no los separa |

Elegido el estado nuevo por el responsable del producto.

## Diseño: correspondencia interna

### Datos

Campo nuevo en `expedientes`: `clase?: 'Externa' | 'Interna'`. Sin el campo, el expediente es
externo (no se migra nada). Se guarda siempre en los expedientes nuevos.

### Formato de radicado

En `src/lib/filing-number.ts`:

- **Entrada externa:** como hoy, `año + 100 + consecutivo de 4 o más cifras`.
- **Entrada interna:** `año + "-" + consecutivo de 6 o más cifras` (ej. `2026-000123`). El año
  debe coincidir con la fecha de radicado. _(Llamado del diseño: "6 o más" sigue el criterio de
  D-30 de no bloquear si el consecutivo crece.)_
- **Salida de un expediente interno** (respuesta, traslado, ampliación, registro tardío y
  corrección de radicados): se acepta **cualquiera de las dos** formas, `año-consecutivo` o
  `año + 200 + consecutivo`. Decidido con el responsable.
- **Salida de un expediente externo:** como hoy, solo serie `200`.

La función de validación recibe la clase del expediente; los mensajes de error explican el
formato esperado según la clase. Por ejemplo, un número `2026-…` escrito en un expediente externo
sugiere cambiar la clase a Interna.

Las series no se cruzan: `radicadosEntrada/2026-000123` y `radicadosEntrada/20261000123` son
documentos distintos, así que el índice de unicidad actual sirve sin cambios.

### Formulario

- Selector **Correspondencia: Externa / Interna** junto al radicado de entrada. Si se escribe un
  número con guion, pasa solo a Interna (se puede cambiar a mano).
- Con **Interna**, el bloque "Solicitantes" se titula **"Remitente"**, su nombre se rotula
  **"Dependencia o funcionario remitente"** y se ocultan **documento** y **tipo de solicitante**
  (se conservan teléfono y correo). Se siguen guardando en `solicitantes[]` con los mismos campos:
  no cambia el modelo. _(Llamado del diseño: el nombre del remitente es obligatorio en la interna,
  porque sin documento es lo único que lo identifica.)_
- Al editar, la clase sigue las mismas reglas que el radicado de entrada: solo Administrador y
  Coordinador la cambian, y si cambia se revalida el formato del número aunque no haya cambiado.

### Dónde se ve

- Etiqueta **Interna** en la lista de Expedientes, el Histórico, el encabezado del detalle y
  Radicación (columna del radicado de entrada). La externa no lleva etiqueta, para no recargar.
- Filtro **Correspondencia: Todas / Externa / Interna** en Expedientes, Histórico y Reportes.
- Columna **Correspondencia** en las exportaciones a Excel de Expedientes, Histórico y Reportes.
- La edición registra el cambio de clase en el historial (`src/lib/expedient-changes.ts`).

### Reglas de Firestore

- `create`: `clase` ausente o en `['Externa', 'Interna']`.
- `update`: solo supervisores cambian `clase` (igual que `numeroRadicado` y `dependencia`).
- El formato del número sigue validándose solo en el cliente (como hoy).

## Diseño: transferencia a otra dependencia

### Dónde está

En el detalle del expediente, **Más acciones → Transferir a otra dependencia**, junto a Ampliar
plazo y Apoyo en respuesta. Visible para quien puede gestionar el expediente
(`canManageExpedient`) mientras esté activo. El diálogo explica en una línea la diferencia con el
traslado por competencia: "El expediente se cierra aquí y deja constancia de a dónde se envió.
Para trasladar y luego responder al ciudadano, use Continuar → Traslado por competencia."

### Qué pide

| Dato                         | Regla                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destino                      | Una de las áreas de `src/lib/dependencies.ts` distinta de la del expediente, u **Otra dependencia de la Alcaldía** con el nombre escrito (3 a 120 caracteres) |
| Motivo                       | Obligatorio, 5 a 1000 caracteres                                                                                                                              |
| Fecha de la transferencia    | Obligatoria; no futura ni anterior a la fecha de radicado. Por defecto, hoy                                                                                   |
| Oficio o radicado (opcional) | Número y fecha del radicado con que se envió, validados como salida según la clase del expediente                                                             |
| Documento (opcional)         | Nombre y enlace de OneDrive institucional del oficio (mismas reglas que los demás documentos), y folios                                                       |

### Qué guarda (un solo lote)

- En el expediente: `estado: 'Transferido'`, `activo: false`, `fechaCierre` = fecha de la
  transferencia, y el campo nuevo:

  ```ts
  transferencia?: {
    destino: string              // nombre para mostrar ("Tesorería", "Secretaría de Gobierno")
    dependenciaDestino?: DependencyId  // solo si es un área de SIGECAT
    motivo: string
    fecha: string                // yyyy-mm-dd
    numeroRadicado?: string
    fechaRadicado?: string
    usuario: string              // nombre de quien la registró
    fechaRegistro: Timestamp
  }
  ```

- Si hay documento: uno nuevo en `documentosWorkflow` de tipo `TRANSFERENCIA` ("Oficio de
  transferencia"), que aparece en la hoja de control.
- Si hay número de radicado: un documento en `radicados` de tipo **Transferencia**, como hacen la
  respuesta y la ampliación.
- Historial: **Transfirió a otra dependencia** con "A Tesorería el 27/10/2026. Motivo: …" y, si
  hay, el radicado.

### Dónde se ve

- **Detalle:** aviso en la parte superior: "Transferido a Tesorería el 27 de octubre de 2026 por
  Ana Pérez. Motivo: …", con el radicado y el enlace al oficio si los hay. El expediente queda en
  modo consulta como cualquier cerrado.
- **Histórico:** la columna de estado muestra **Transferido** (hoy distingue Finalizado y
  Archivado), con el destino al pasar el cursor o debajo en celular.
- **Reportes:** `closedOnTime` devuelve `null` para los transferidos (no cuentan en oportunidad).
  Indicador aparte **Transferidos** en el periodo y columna **Transferido a** en la exportación.
- **Panel de dirección:** no cuentan como respondidos (`isAnswered` ya exige "Archivo
  (Finalizado)"). No se agrega un indicador nuevo.
- **Calendario:** dejan de mostrarse sus vencimientos (`isDeadlineOf` ya excluye los cerrados que
  no son Finalizado).
- **Radicación:** los radicados de tipo Transferencia aparecen con los demás.

### Reglas de Firestore

- `isAllowedActivoChange`: además de lo actual, un usuario operativo que gestiona el expediente
  puede pasar `activo` a `false` si el nuevo `estado` es `'Transferido'` y trae `transferencia` con
  `destino` (string, 3 a 120) y `motivo` (string, 5 a 1000).
- `transferencia` no puede cambiar una vez escrita (solo un Administrador, como cualquier
  corrección de cerrados).
- `radicados`: se admite el tipo `Transferencia` (la regla de creación actual ya lo permite: solo
  exige poder gestionar el expediente antes del lote).

### Lógica pura y pruebas

`src/lib/expedient-transfer.ts` con `getTransferError(input, context)` y `planTransfer(...)`
(destino distinto del área actual, fechas, longitudes, formato del radicado según la clase), con
`expedient-transfer.test.ts`. Pruebas de reglas en `tests/firestore-rules.test.ts`: un
Funcionario asignado transfiere; uno que no lo gestiona no; sin motivo no; Directivo no.

## Archivos que se tocan

- `src/types/expedient.ts`: `clase`, `transferencia`, estado `Transferido`, tipo de documento
  `TRANSFERENCIA`, `isFinalizedExpedient`.
- `src/lib/filing-number.ts` (+ prueba), `expedient-workflow.ts`, `late-registration.ts`,
  `deadline-extension.ts`, `record-corrections.ts`: pasar la clase al validar la salida.
- `src/lib/expedient-transfer.ts` (nuevo, + prueba), `expedient-changes.ts`.
- `src/features/expedients/schemas/expedient-schema.ts`, `components/expedient-form.tsx`,
  `expedient-table.tsx`, `expedient-summary.tsx`, `expedient-filters.ts`, diálogo nuevo
  `transfer-dialog.tsx`.
- `src/services/expedient.service.ts`: `clase` en `toExpedientData`, `transferExpedient(...)`.
- `src/pages/expedient-detail-page.tsx`, `historical-page.tsx`, `reports-page.tsx`,
  `expedients-page.tsx`, `filing-page.tsx`, `help-page.tsx`.
- `firestore.rules`, `tests/firestore-rules.test.ts`.
- Documentación: `docs/flujo-y-permisos.md`, `docs/modelo-de-datos.md`, `docs/decisiones.md`
  (D-39 correspondencia interna; D-40 transferencia, que reabre en parte la D-28 descartada: el
  expediente sale del área pero no se traspasa dentro de SIGECAT).

## Publicación

Las reglas nuevas aceptan todo lo que acepta la versión actual, así que se despliegan **primero**
(`firebase deploy --only firestore:rules`) y después se publica el sitio con el `push`. Al revés,
el sitio nuevo intentaría guardar `clase` o `Transferido` y las reglas viejas lo rechazarían.

## Queda a criterio de quien construye

- Textos exactos de etiquetas, ayudas y mensajes de error, en el tono de la aplicación.
- Ubicación exacta del selector de clase y del aviso de transferencia, siguiendo los componentes
  de `src/components/ui/`.
- Si la exportación de Radicación también lleva la columna de correspondencia.
