# Correspondencia interna y transferencia a otra dependencia: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar correspondencia interna (`2026-xxxxxx`) junto a la externa y permitir cerrar un
expediente como **Transferido** a otra dependencia con su traza.

**Architecture:** Lógica pura y probada en `src/lib/` (clase de correspondencia, formato de
radicados, transferencia); el servicio la guarda en un `writeBatch` con su historial;
`firestore.rules` repite lo que la interfaz decide, con pruebas en el emulador. Sin lecturas
nuevas: los filtros se aplican sobre lo ya descargado.

**Tech Stack:** React 19, TypeScript strict, React Hook Form + Zod, TanStack Query, Firestore,
`node:test` con `tsx`, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-27-correspondencia-interna-y-transferencias-design.md`

## Global Constraints

- Repositorio: `C:\Users\juanj\OneDrive\Documentos\sigecat-limpio`, rama
  `correspondencia-interna-y-transferencias`. Nunca trabajar en `Documentos\SIGECAT`.
- Identificadores en inglés; campos de Firestore y textos de la interfaz en español.
- Solo `src/services/` importa `firebase/firestore`.
- Expedientes sin `clase` son `'Externa'`; no se migran datos.
- Entrada interna: `^(\d{4})-(\d{6,})$`, año igual al de la fecha de radicado.
- Salida de un expediente interno: acepta `año-consecutivo` (6+ cifras) **o** `año + 200 +
consecutivo` (4+ cifras). Salida de un externo: solo serie `200`, como hoy.
- Transferencia: destino 3 a 120 caracteres, motivo 5 a 1000, fecha no futura ni anterior a la
  fecha de radicado, destino distinto del área del expediente.
- Cada tarea termina con `npm test`, `npm run lint`, `npx tsc -b` y `npm run format:check` en
  verde; las que tocan reglas, también `npm run test:rules` (requiere Java 21 y Firebase CLI).
- Mensajes de commit en español, terminados en
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Expediente externo antiguo con un radicado histórico fuera de formato: editarlo sin tocar
  número ni clase debe seguir funcionando (Task 3, prueba del esquema).
- Escribir `2026-000123` con la clase en Externa (el usuario la cambió a mano): el error debe
  sugerir la clase Interna, no un error genérico (Task 1).
- Transferir un expediente a mitad del traslado por competencia (`Generar radicado de traslado`):
  debe cerrarse igual y conservar `trasladoPorCompetencia` (Task 7, prueba de reglas).
- Un Funcionario que intenta escribir `transferencia` sin pasar a `Transferido`, o cambiarla
  después: las reglas lo rechazan (Task 7).
- Transferido en Reportes y Panel: nunca entra en oportunidad ni en respondidos (Task 9).

---

### Task 1: Clase de correspondencia y formato de radicados

**Files:**

- Create: `src/lib/correspondence.ts`, `src/lib/correspondence.test.ts`
- Modify: `src/lib/filing-number.ts`, `src/lib/filing-number.test.ts`

**Interfaces:**

- Produces (en `correspondence.ts`):
  - `export const CORRESPONDENCE_CLASSES = ['Externa', 'Interna'] as const`
  - `export type CorrespondenceClass = (typeof CORRESPONDENCE_CLASSES)[number]`
  - `getCorrespondenceClass(item: { clase?: string }): CorrespondenceClass` (sin campo o valor
    desconocido → `'Externa'`)
  - `detectCorrespondenceClass(number: string): CorrespondenceClass | undefined` (`'Interna'` si
    el número recortado tiene la forma `dddd-…`, `'Externa'` si son solo dígitos, si no undefined)
  - `matchesCorrespondence(item: { clase?: string }, filter: '' | CorrespondenceClass): boolean`
- Produces (en `filing-number.ts`): `getFilingNumberError(number, date, direction, correspondenceClass: CorrespondenceClass = 'Externa'): string | null`

- [ ] **Step 1: Pruebas que fallan**

`correspondence.test.ts`:

```ts
test('sin clase es externa', () => {
  assert.equal(getCorrespondenceClass({}), 'Externa')
  assert.equal(getCorrespondenceClass({ clase: 'Interna' }), 'Interna')
})
test('detecta la clase por el formato', () => {
  assert.equal(detectCorrespondenceClass(' 2026-000123 '), 'Interna')
  assert.equal(detectCorrespondenceClass('20261000123'), 'Externa')
  assert.equal(detectCorrespondenceClass('2026-'), 'Interna')
  assert.equal(detectCorrespondenceClass('abc'), undefined)
})
test('filtra por clase', () => {
  assert.equal(matchesCorrespondence({}, 'Externa'), true)
  assert.equal(matchesCorrespondence({ clase: 'Interna' }, 'Externa'), false)
  assert.equal(matchesCorrespondence({ clase: 'Interna' }, ''), true)
})
```

`filing-number.test.ts` (las pruebas actuales no cambian):

```ts
test('entrada interna: año, guion y 6 cifras o más', () => {
  assert.equal(getFilingNumberError('2026-000123', '2026-10-27', 'entrada', 'Interna'), null)
  assert.equal(getFilingNumberError('2026-1234567', '2026-10-27', 'entrada', 'Interna'), null)
  assert.match(
    getFilingNumberError('2026-12345', '2026-10-27', 'entrada', 'Interna')!,
    /2026-000001/,
  )
  assert.match(getFilingNumberError('20261000123', '2026-10-27', 'entrada', 'Interna')!, /Externa/)
  assert.match(
    getFilingNumberError('2025-000123', '2026-01-02', 'entrada', 'Interna')!,
    /2025.*2026/,
  )
})
test('un número interno en un expediente externo sugiere la clase Interna', () => {
  assert.match(getFilingNumberError('2026-000123', '2026-10-27', 'entrada')!, /Interna/)
})
test('la salida de un interno acepta los dos formatos', () => {
  assert.equal(getFilingNumberError('2026-000456', '2026-10-27', 'salida', 'Interna'), null)
  assert.equal(getFilingNumberError('20262000456', '2026-10-27', 'salida', 'Interna'), null)
  assert.match(
    getFilingNumberError('20261000456', '2026-10-27', 'salida', 'Interna')!,
    /de entrada/,
  )
  assert.match(getFilingNumberError('2026-000456', '2026-10-27', 'salida')!, /Interna/)
})
```

- [ ] **Step 2: Correr y ver que fallan** — `npm test` → FAIL (módulo y parámetro inexistentes).

- [ ] **Step 3: Implementar.** `correspondence.ts` según Interfaces. En `getFilingNumberError`,
      si el número tiene forma interna: válido con `Interna` (entrada o salida) si cumple
      `^(\d{4})-(\d{6,})$` y el año coincide; con `Externa`, error que diga que es un radicado de
      correspondencia interna y pida elegir la clase Interna. Si tiene forma de Archivo: entrada
      interna → error que pida elegir la clase Externa; salida interna → mismas reglas que la salida
      externa. Ejemplo de formato en los mensajes: `${year}-000001`. Actualizar el comentario de
      cabecera.

- [ ] **Step 4: Correr** — `npm test` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Clase de correspondencia y formato de radicado interno"`

### Task 2: La salida valida según la clase del expediente

**Files:**

- Modify: `src/lib/expedient-workflow.ts`, `src/lib/deadline-extension.ts`,
  `src/lib/late-registration.ts`, `src/lib/record-corrections.ts` y sus `.test.ts`
- Modify: `src/features/expedients/components/actuation-dialog.tsx`,
  `extension-dialog.tsx`, `late-registration-dialog.tsx`, `src/services/expedient.service.ts`

**Interfaces:**

- Consumes: `getFilingNumberError(..., correspondenceClass)`, `getCorrespondenceClass` (Task 1)
- Produces:
  - `getMissingRequirement(status, input, documents, correspondenceClass: CorrespondenceClass = 'Externa')`
  - `planActuation(expedient: Pick<Expedient, 'estado' | 'trasladoPorCompetencia' | 'funcionarioAsignado' | 'clase'>, input)` (lee la clase del expediente)
  - `ExtensionContext.correspondenceClass?: CorrespondenceClass`
  - `LateRegistrationContext.correspondenceClass?: CorrespondenceClass`
  - `getFilingCorrectionError(correction, previousDate, today, correspondenceClass: CorrespondenceClass = 'Externa')`
  - Requiere `clase?: CorrespondenceClass` en `Expedient` (se agrega en este task a `src/types/expedient.ts`).

- [ ] **Step 1: Pruebas que fallan** — una por módulo, con un número `2026-000456` del
      `2026-10-27`:
  - `expedient-workflow.test.ts`: `planActuation({ estado: 'Radicado de salida', clase: 'Interna' }, input)`
    devuelve `kind: 'complete'` con `fields.numeroRadicadoActuacion === '2026-000456'`; con
    `clase` ausente lanza un error que contiene `Interna`.
  - `deadline-extension.test.ts`: `getExtensionError` con ese número y `correspondenceClass: 'Interna'` → `null`; sin clase → `/Interna/`.
  - `late-registration.test.ts`: `getLateRegistrationIssue` con una respuesta `2026-000456` y
    `correspondenceClass: 'Interna'` → sin problema en la sección `outcome`.
  - `record-corrections.test.ts`: `getFilingCorrectionError({ previousNumber: '20262000001', number: '2026-000456', date: '2026-10-27' }, '2026-10-20', '2026-10-27', 'Interna')` → `null`.

- [ ] **Step 2: Correr** — `npm test` → FAIL.

- [ ] **Step 3: Implementar** pasando la clase a cada llamada de `getFilingNumberError(..., 'salida', …)`.
      En los diálogos, pasar `getCorrespondenceClass(expedient)`. En `correctFiling`
      (`expedient.service.ts`), leer el expediente **antes** de validar y pasar su clase a
      `getFilingCorrectionError`.

- [ ] **Step 4: Correr** — `npm test`, `npx tsc -b` → PASS.

- [ ] **Step 5: Commit** — `"La salida de un expediente interno acepta los dos formatos"`

### Task 3: Registrar y editar correspondencia interna (formulario, servicio, reglas)

**Files:**

- Modify: `src/types/expedient.ts` (`ExpedientFormData.clase: CorrespondenceClass`)
- Modify: `src/features/expedients/schemas/expedient-schema.ts`,
  `components/expedient-form.tsx`, `src/services/expedient.service.ts`,
  `src/lib/expedient-changes.ts` (+ prueba), `firestore.rules`, `tests/firestore-rules.test.ts`
- Test: `src/features/expedients/schemas/expedient-schema.test.ts` (nuevo; agregar
  `src/features/expedients/schemas/*.test.ts` al script `test` de `package.json`)

**Interfaces:**

- Consumes: Task 1.
- Produces: `createExpedientSchema(previous?: { numeroRadicado: string; clase: CorrespondenceClass })`
  (antes recibía solo el número); `EditableSnapshot.correspondencia: CorrespondenceClass`.

- [ ] **Step 1: Pruebas que fallan**
  - Esquema: interna con `2026-000123` y remitente → válido; interna sin nombre de remitente →
    issue en `solicitantes.0.nombre` con mensaje `Escribe la dependencia o funcionario remitente.`;
    edición de un externo con número histórico `DP6480` sin cambiar número ni clase → válido;
    mismo número pero clase cambiada a Interna → issue en `numeroRadicado`.
  - `expedient-changes.test.ts`: cambiar `correspondencia` de Externa a Interna produce
    `Correspondencia: Externa → Interna`.
  - Reglas: `createBatch(as('ana'), { clase: 'Interna', numeroRadicado: '2026-000009' })` tiene
    éxito; `{ clase: 'Otra' }` falla; Ana (Funcionario) actualizando `clase` de `e1` falla; el
    coordinador lo logra.

- [ ] **Step 2: Correr** — `npm test` y `npm run test:rules` → FAIL.

- [ ] **Step 3: Implementar**
  - Esquema: `clase: z.enum(CORRESPONDENCE_CLASSES)`; revalidar el número si cambió el número
    **o** la clase; nombre del primer solicitante obligatorio si es Interna.
  - Formulario: `Select` "Correspondencia" (Externa/Interna) junto al radicado de entrada,
    deshabilitado para quien no es supervisor al editar (como el área). Al escribir el número,
    si `detectCorrespondenceClass` da una clase distinta, fijarla con `setValue`. Con Interna, la
    sección se titula "Remitente", el nombre se rotula "Dependencia o funcionario remitente" y se
    ocultan documento y tipo de solicitante; el botón "Agregar solicitante" no aparece.
  - Servicio: `toExpedientData` guarda `clase`; `updateExpedient` agrega `correspondencia` a los
    dos snapshots con `getCorrespondenceClass(current)` y `values.clase`.
  - Reglas: en `create`, `request.resource.data.get('clase', 'Externa') in ['Externa', 'Interna']`;
    en `update`, sumar `'clase'` a la lista que solo cambian supervisores (junto a
    `numeroRadicado` y `dependencia`) y validar el valor igual.

- [ ] **Step 4: Correr** — `npm test`, `npm run test:rules`, `npx tsc -b` → PASS.

- [ ] **Step 5: Commit** — `"Registro de correspondencia interna"`

### Task 4: Ver y filtrar la correspondencia interna

**Files:**

- Modify: `src/features/expedients/components/expedient-table.tsx`, `expedient-summary.tsx`,
  `src/pages/expedient-detail-page.tsx`, `expedients-page.tsx`, `historical-page.tsx`,
  `reports-page.tsx`, `filing-page.tsx`, `help-page.tsx`
- Modify: `docs/flujo-y-permisos.md`, `docs/modelo-de-datos.md`, `docs/decisiones.md`

**Interfaces:** Consumes `getCorrespondenceClass`, `matchesCorrespondence`,
`detectCorrespondenceClass` (Task 1).

- [ ] **Step 1: Implementar**
  - `Badge` "Interna" (variante `info`) al lado del radicado de entrada en la tabla de
    expedientes, el Histórico y el encabezado del detalle; en Radicación, junto a
    `expedienteRadicado` cuando `detectCorrespondenceClass(expedienteRadicado) === 'Interna'`
    (el radicado no guarda la clase; el formato interno es exclusivo).
  - `Select` "Correspondencia" (Todas/Externa/Interna) en Expedientes, Histórico y Reportes,
    junto al filtro de área, combinado con `matchesCorrespondence`.
  - Columna "Correspondencia" en los CSV de Expedientes (si exporta), Histórico y Reportes.
  - Guía rápida: un párrafo sobre correspondencia interna y su formato.
  - Docs: `clase` en el modelo; formato interno en flujo-y-permisos; D-39 en decisiones.

- [ ] **Step 2: Verificar** — `npm test`, `npm run lint`, `npx tsc -b`, `npm run format:check`
      → PASS; `npm run dev` y comprobar a ojo filtro y etiqueta con datos del emulador.

- [ ] **Step 3: Commit** — `"Etiqueta y filtro de correspondencia interna"`

### Task 5: Tipos del estado Transferido

**Files:** Modify `src/types/expedient.ts`, `src/lib/management-panel.test.ts`, `src/lib/calendar.test.ts`

**Interfaces:**

- Produces:
  - `'Transferido'` al final de `EXPEDIENT_STATUSES` (después de `'Archivado'`).
  - `WorkflowDocumentType` incluye `'TRANSFERENCIA'`, etiqueta `'Oficio de transferencia'`.
  - ```ts
    export interface ExpedientTransfer {
      destino: string
      dependenciaDestino?: DependencyId
      motivo: string
      fecha: string // yyyy-mm-dd
      numeroRadicado?: string
      fechaRadicado?: string
      usuario: string // nombre de quien la registró
      fechaRegistro: Timestamp
    }
    ```
    y `Expedient.transferencia?: ExpedientTransfer`.
  - `isFinalizedExpedient` incluye `'Transferido'`.

- [ ] **Step 1: Pruebas que fallan** — `isAnswered({ estado: 'Transferido', activo: false })` es
      `false`; `isDeadlineOf` de un transferido asignado al uid es `false`; `isFinalizedExpedient({ estado: 'Transferido', activo: true })` es `true`.
- [ ] **Step 2: Correr** — FAIL (el estado no existe en el tipo).
- [ ] **Step 3: Implementar** según Interfaces.
- [ ] **Step 4: Correr** — `npm test`, `npx tsc -b` → PASS (corregir los `switch`/`Record` que
      TypeScript señale).
- [ ] **Step 5: Commit** — `"Estado Transferido en el modelo"`

### Task 6: Reglas puras de la transferencia

**Files:** Create `src/lib/expedient-transfer.ts`, `src/lib/expedient-transfer.test.ts`

**Interfaces:**

- Consumes: `CorrespondenceClass`, `getFilingNumberError` (Task 1); `parseDocumentLink`,
  `NewDocumentLink` de `src/lib/document-links.ts`; `DEPENDENCIES`, `getDependencyName`.
- Produces:

  ```ts
  export const OTHER_DESTINATION = 'otra'
  export interface TransferInput {
    destination: DependencyId | typeof OTHER_DESTINATION | ''
    otherDestination: string
    reason: string
    date: string
    filingNumber: string
    filingDate: string
    documentName: string
    documentUrl: string
    folios: string
  }
  export const EMPTY_TRANSFER_INPUT: TransferInput
  export interface TransferContext {
    dependency: DependencyId
    entryDate: string // yyyy-mm-dd
    correspondenceClass: CorrespondenceClass
    today?: Date
  }
  export function getTransferError(input: TransferInput, context: TransferContext): string | null
  export interface TransferPlan {
    transfer: Omit<ExpedientTransfer, 'usuario' | 'fechaRegistro'>
    document?: NewDocumentLink & { radicadoNumero?: string; radicadoFecha?: string }
    filing?: { numero: string; fecha: string }
    historyDetail: string
  }
  export function planTransfer(input: TransferInput, context: TransferContext): TransferPlan // lanza Error con getTransferError
  ```

- [ ] **Step 1: Pruebas que fallan** (contexto: `catastro`, entrada `2026-10-01`, hoy `2026-10-27`)
  - Sin destino → `/destino/`; destino `catastro` → `/misma área/`; `otra` con
    `otherDestination: 'ab'` → `/3/`; motivo `'abcd'` → `/motivo/`; fecha
    `2026-10-28` → `/futura/`; fecha `2026-09-30` → `/anterior/`.
  - Número sin fecha → error; número `2026-000456` con clase Externa → `/Interna/`; con Interna → válido.
  - Documento con enlace no institucional → error de `parseDocumentLink`.
  - `planTransfer` a `tesoreria`: `transfer.destino === 'Tesorería'`,
    `transfer.dependenciaDestino === 'tesoreria'`, sin `document` ni `filing`, y
    `historyDetail` igual a `'A Tesorería el 27/10/2026. Motivo: …'` (fecha con `formatDate` de
    `src/lib/format.ts`).
  - `planTransfer` a `otra` "Secretaría de Gobierno" con radicado y documento:
    `dependenciaDestino` ausente, `filing` = `{ numero, fecha }`, `document.radicadoNumero` igual
    al número, y `historyDetail` termina en `Radicado 20262000456.`
- [ ] **Step 2: Correr** — FAIL.
- [ ] **Step 3: Implementar** según Interfaces; textos recortados con `trim()`.
- [ ] **Step 4: Correr** — PASS.
- [ ] **Step 5: Commit** — `"Reglas de la transferencia a otra dependencia"`

### Task 7: Reglas de Firestore para la transferencia

**Files:** Modify `firestore.rules`, `tests/firestore-rules.test.ts`

- [ ] **Step 1: Pruebas que fallan** — sobre `e1` (Ana, activo, `En respuesta`), con
      `transferencia = { destino: 'Tesorería', motivo: 'No es de Catastro', fecha: '2026-10-27', usuario: 'Ana', fechaRegistro: serverTimestamp() }`
      y `estado: 'Transferido', activo: false, participantes: arrayUnion('ana')`:
  - Ana lo logra; Luis (participó, no gestiona) falla; `director` falla.
  - Con `e1` en `Generar radicado de traslado` y `trasladoPorCompetencia: true`, Ana transfiere
    sin tocar ese campo y lo logra; el documento conserva `trasladoPorCompetencia`.
  - Sin `transferencia`, con motivo de 4 caracteres o destino de 2 → falla.
  - `transferencia` sin pasar a `Transferido` (expediente sigue activo) → falla.
  - Ya transferido: el coordinador cambia `transferencia.motivo` → falla; el admin → lo logra.
- [ ] **Step 2: Correr** — `npm run test:rules` → FAIL.
- [ ] **Step 3: Implementar** en `firestore.rules`:
  - `function isValidTransfer(data)`: `estado == 'Transferido'`, `activo == false`,
    `transferencia is map`, `destino is string` de 3 a 120, `motivo is string` de 5 a 1000.
  - `isAllowedActivoChange`: además, `activo == false` si `isValidTransfer(request.resource.data)`.
  - En `update`: si `'transferencia'` está en `affectedKeys`, exigir `isAdministrator()` o
    (`resource.data.get('transferencia', null) == null` y `isValidTransfer(request.resource.data)`);
    y si el nuevo `estado` es `'Transferido'` y el anterior no, exigir `isValidTransfer`.
- [ ] **Step 4: Correr** — `npm run test:rules` → PASS (las pruebas anteriores también).
- [ ] **Step 5: Commit** — `"Reglas de Firestore para expedientes transferidos"`

### Task 8: Transferir desde el detalle

**Files:**

- Modify: `src/services/expedient.service.ts`, `src/pages/expedient-detail-page.tsx`
- Create: `src/features/expedients/components/transfer-dialog.tsx`

**Interfaces:**

- Consumes: `planTransfer`, `TransferInput`, `EMPTY_TRANSFER_INPUT` (Task 6); `ExpedientTransfer` (Task 5).
- Produces: `transferExpedient(id: string, input: TransferInput, userId: string, userName: string): Promise<void>`

- [ ] **Step 1: Servicio.** `transferExpedient` lee el expediente, rechaza si está cerrado
      (`'El expediente ya está cerrado.'`), arma el plan con
      `{ dependency: getExpedientDependency(current), entryDate, correspondenceClass: getCorrespondenceClass(current) }`,
      comprueba que el radicado no exista para el expediente (como `extendExpedientDeadline`) y en un
      lote: `estado: 'Transferido'`, `activo: false`,
      `fechaCierre: Timestamp.fromDate(fromDateKey(plan.transfer.fecha))`, `transferencia` con
      `usuario: userName` y `fechaRegistro: serverTimestamp()`, el documento `TRANSFERENCIA` con
      `arrayUnion` si hay, `fechaActualizacion`, `withParticipants(userId)`; historial
      `'Transfirió a otra dependencia'` con `plan.historyDetail`; si hay radicado,
      `registerFiling` con `tipo: 'Transferencia'`, `estado: 'Transferido'`, `observaciones: motivo`.
- [ ] **Step 2: Diálogo.** `transfer-dialog.tsx` con el patrón de `extension-dialog.tsx`
      (`Dialog`, `getTransferError` en vivo, `useMutation`, invalidar las consultas que invalida la
      ampliación, `useToast`). Campos: Destino (`Select` con las áreas salvo la del expediente y
      "Otra dependencia de la Alcaldía", que muestra un `Input` para el nombre), Motivo, Fecha (hoy por
      defecto), sección plegable "Oficio de envío (opcional)" con número, fecha, nombre, enlace y
      folios. Texto fijo arriba: "El expediente se cierra aquí y deja constancia de a dónde se
      envió. Para trasladar y luego responder al ciudadano, use Continuar → Traslado por
      competencia." Botón final "Transferir y cerrar" con `ConfirmDialog`.
- [ ] **Step 3: Menú y aviso.** En "Más acciones", con `canManage` y expediente activo:
      `{ label: 'Transferir a otra dependencia', description: 'Cerrar aquí y dejar constancia de a dónde se envió.', icon: ArrowRightLeft }`.
      Si `expedient.transferencia`, aviso (`feedback.tsx`) arriba del detalle: "Transferido a
      {destino} el {fecha} por {usuario}. Motivo: {motivo}", con radicado y enlace al oficio si hay.
- [ ] **Step 4: Verificar** — `npm test`, `npm run lint`, `npx tsc -b`; en el emulador
      (`VITE_USE_EMULATORS`), transferir un expediente como Funcionario y comprobar estado, aviso,
      historial, documento y radicado.
- [ ] **Step 5: Commit** — `"Transferir un expediente a otra dependencia"`

### Task 9: Transferidos en Histórico, Reportes, Radicación y documentación

**Files:**

- Modify: `src/pages/historical-page.tsx`, `reports-page.tsx`, `filing-page.tsx`, `help-page.tsx`,
  `src/lib/management-panel.ts` (+ prueba si hace falta)
- Modify: `docs/flujo-y-permisos.md`, `docs/modelo-de-datos.md`, `docs/decisiones.md`

- [ ] **Step 1: Prueba que falla** — extraer `closedOnTime` de `reports-page.tsx` a
      `src/lib/management-panel.ts` como `export function closedOnTime(item: Expedient): boolean | null`
      (si ya existe una equivalente allí, reutilizarla) y probar que un `Transferido` da `null`.
- [ ] **Step 2: Correr** — FAIL. **Step 3: Implementar** y correr → PASS.
- [ ] **Step 4: Interfaz**
  - Histórico: estado **Transferido** (además de Finalizado y Archivado), con el destino debajo;
    columna "Transferido a" en el CSV.
  - Reportes: indicador "Transferidos" del periodo y columna "Transferido a" en el CSV.
  - Radicación: el filtro de tipo incluye "Transferencia" si la página tiene lista fija.
  - Guía rápida: diferencia entre Traslado por competencia y Transferir a otra dependencia.
  - Docs: estado `Transferido` y `transferencia` en el modelo; sección "Transferencia a otra
    dependencia" en flujo-y-permisos; D-40 en decisiones (reabre en parte la D-28).
- [ ] **Step 5: Verificar** — `npm test`, `npm run lint`, `npx tsc -b`, `npm run format:check`,
      `npm run test:rules` → PASS.
- [ ] **Step 6: Commit** — `"Transferidos en Histórico y Reportes, y documentación"`

## Publicación (después de aprobar la rama)

1. `firebase deploy --only firestore:rules --project sigecat-7c6ec` (las reglas nuevas aceptan
   todo lo que acepta la versión actual).
2. Fusionar a `main` y `push`: el CI vuelve a correr todo y publica el sitio.
