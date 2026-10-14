# EMERGENCIA: recuperar la base de datos de SIGECAT

Guía para reconstruir los datos de SIGECAT si se borraron, se dañaron o desapareció el proyecto de
Firebase. Está escrita para seguirla paso a paso, con o sin ayuda de un chat de IA. Probada con un
simulacro completo el 13 de octubre de 2026: 316 documentos y 5 cuentas reconstruidos sin
diferencias.

## 0. Antes de nada

1. **Pida que nadie registre ni modifique nada en SIGECAT** hasta terminar. Lo que se escriba
   durante la recuperación puede perderse o mezclarse.
2. **No borre nada**: ni documentos en la consola de Firebase, ni copias, ni el repositorio.
3. Anote qué pasó, cuándo se notó y qué se ve (o no se ve) en la aplicación.
4. Identifique el escenario:
   - **A.** El proyecto de Firebase existe, pero faltan o están mal algunos datos.
   - **B.** El proyecto de Firebase ya no existe o no hay forma de entrar a él.

### Si va a usar un chat de IA

Pegue esta guía completa en el chat, con este mensaje, y vaya pegando el resultado de cada comando:

> Soy responsable de SIGECAT, una aplicación React + Firebase (Firestore y Authentication) de la
> Alcaldía de Girardota. Necesito recuperar la base de datos siguiendo esta guía. El escenario es
> [A o B] y lo que pasó es: [descripción]. Acompáñame paso a paso, no me hagas ejecutar nada que
> borre datos y antes de cada comando con --apply explícame qué va a escribir.

## 1. Dónde está cada cosa

| Qué                          | Dónde                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Proyecto de Firebase         | `sigecat-7c6ec` — Firestore nativo en `southamerica-east1`, autenticación con correo y contraseña           |
| Código, reglas e índices     | GitHub `JuanJoseXG23/sigecat` (`firestore.rules`, `firestore.indexes.json`)                                 |
| Sitio publicado              | `https://juanjosexg23.github.io/sigecat/` (GitHub Pages; se publica al subir a `main`)                      |
| Copia diaria                 | Drive de la cuenta institucional que ejecuta Apps Script, carpeta **SIGECAT copias de seguridad**; 30 días  |
| Copias manuales              | Donde se hayan guardado con `scripts/export-backup.ts` (disco externo o carpeta restringida)                |
| Correos y copias automáticas | Proyecto de Google Apps Script con `google-apps-script/Code.gs`                                             |
| Documentos escaneados (PDF)  | OneDrive/SharePoint institucional. **No dependen de Firebase**: los expedientes solo guardan el enlace      |
| Llave de administración      | `secrets/firebase-admin.json` (o la ruta de `FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH`). Nunca en el repositorio |

Qué **no** está en ninguna copia y cómo se resuelve:

- **Contraseñas**: se recrean las cuentas con el mismo identificador y cada persona define una
  nueva con un enlace (paso B6).
- **Lo registrado después de la última copia**: se vuelve a registrar con los documentos físicos,
  OneDrive y la planilla de Archivo, usando **Registrar atrasado** con las fechas reales.

## 2. Requisitos en el equipo

- Node.js 22 o superior y el repositorio clonado: `git clone https://github.com/JuanJoseXG23/sigecat.git`,
  luego `npm ci`.
- Firebase CLI (`npm install -g firebase-tools`) y Java 21 o superior para el emulador.
- La llave de administración del proyecto donde se va a restaurar (consola de Firebase →
  Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada). Guárdela fuera de
  OneDrive y del repositorio, e indique su ruta:

```powershell
$env:FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH = 'C:\llaves\sigecat-admin.json'
```

## 3. Elegir y comprobar la copia

1. Use **la copia más reciente anterior al problema**. La diaria de Drive pierde como mucho un día.
2. Descárguela (`sigecat-AAAA-MM-DD_HHMM.json.gz`) a una carpeta local que no esté en OneDrive.
3. Si tiene la huella SHA-256 anotada, compárela:

```powershell
Get-FileHash .\sigecat-2026-10-14_0200.json.gz -Algorithm SHA256
```

4. **Ensaye primero en el emulador** (no toca nada real). Debe terminar en `SIMULACRO EXITOSO`:

```powershell
$env:BACKUP_FILE = 'C:\recuperacion\sigecat-2026-10-14_0200.json.gz'
npm run drill
```

Si el simulacro falla, la copia está incompleta o dañada: pruebe con la del día anterior.

## Escenario A: el proyecto existe, faltan o están mal algunos datos

A1. Simule (solo lee). Muestra qué documentos faltan y cuáles cambiaron después de la copia:

```powershell
npx tsx scripts/restore-backup.ts --file=C:\recuperacion\sigecat-2026-10-14_0200.json.gz
```

A2. Devuelva **solo lo que falta** (no toca lo que existe):

```powershell
npx tsx scripts/restore-backup.ts --file=C:\recuperacion\sigecat-2026-10-14_0200.json.gz --apply
```

A3. Solo si hay documentos **dañados** (existen pero con datos incorrectos), devuélvalos a como
estaban, limitando a las colecciones afectadas. Cuidado: deshace también los cambios legítimos
hechos después de la copia en esas colecciones.

```powershell
npx tsx scripts/restore-backup.ts --file=... --collections=expedientes --apply --overwrite
```

A4. Vuelva a ejecutar la simulación de A1: debe decir `Faltan en la base: 0`.

A5. Si se borraron **cuentas de usuario** (no pueden entrar, pero su perfil existe), recréelas:
`npx tsx scripts/rebuild-auth-users.ts` y luego con `--apply --links`.

Siga con **Verificación final**.

## Escenario B: el proyecto de Firebase desapareció

B1. **Proyecto nuevo.** En `https://console.firebase.google.com` cree un proyecto con una cuenta
**institucional** (no personal). Anote su id (por ejemplo `sigecat-girardota`).

B2. **Firestore.** Cree la base de datos en modo nativo, ubicación `southamerica-east1`. En la
configuración de la base, active la **protección contra eliminación**.

B3. **Authentication.** Active el proveedor **Correo electrónico/contraseña**. En
Configuración → Dominios autorizados, agregue `juanjosexg23.github.io` (o el dominio donde se
publique).

B4. **Llave.** Genere la llave de administración del proyecto nuevo (paso 2) e indique su ruta.

B5. **Datos.** Simule y luego aplique, confirmando el proyecto nuevo:

```powershell
npx tsx scripts/restore-backup.ts --file=C:\recuperacion\sigecat-....json.gz --target-project=sigecat-girardota
npx tsx scripts/restore-backup.ts --file=C:\recuperacion\sigecat-....json.gz --target-project=sigecat-girardota --apply
```

B6. **Cuentas.** Recrea cada cuenta con su mismo identificador y genera el enlace para que cada
persona defina su contraseña. Envíe cada enlace solo a su dueño:

```powershell
npx tsx scripts/rebuild-auth-users.ts
npx tsx scripts/rebuild-auth-users.ts --apply --links
```

B7. **Reglas e índices** (sin ellos nadie puede leer ni escribir):

```powershell
firebase deploy --only firestore:rules,firestore:indexes --project sigecat-girardota
```

B8. **Aplicación.** En la consola, Configuración del proyecto → Tus apps → agregue una app web y
copie su configuración en `.env.production` (las seis variables `VITE_FIREBASE_*`). Reemplace
`sigecat-7c6ec` por el id nuevo en `README.md` y en esta guía. Suba a `main`: GitHub Actions
prueba y publica.

B9. **Apps Script** (correos y copias): en el proyecto de Apps Script cambie la propiedad
`FIREBASE_PROJECT_ID` al id nuevo; en Google Cloud Console del proyecto nuevo dé a la cuenta
institucional el rol **Cloud Datastore User**; ejecute `setupDailyDeadlineAlerts` y
`setupDailyBackup`.

## Verificación final

- [ ] La simulación de `restore-backup` dice `Faltan en la base: 0`.
- [ ] Un Administrador entra y ve en Expedientes y en el Histórico la cantidad de la copia.
- [ ] Un Funcionario entra y ve solo sus expedientes (las reglas funcionan).
- [ ] Un expediente abierto muestra su historial, radicados y documentos de OneDrive.
- [ ] Se puede registrar un expediente de prueba y luego archivarlo.
- [ ] Al día siguiente aparece una copia nueva en Drive.
- [ ] Se volvió a registrar, con **Registrar atrasado**, lo hecho después de la copia.
- [ ] Se avisó a los usuarios que pueden volver a trabajar.

## Prevención (revisar cada tres meses)

- **Simulacro**: descargue la copia más reciente de Drive y ejecute `npm run drill` (10 minutos).
  Si falla, arréglelo antes de necesitarlo.
- **Propiedad institucional**: una cuenta institucional debe ser **Propietaria** del proyecto de
  Firebase (consola → Configuración → Usuarios y permisos) y tener acceso de administración al
  repositorio de GitHub. Si el proyecto depende de una sola cuenta personal, se pierde con ella.
- **Protección contra eliminación** de la base activa (consola de Google Cloud → Firestore →
  base `(default)` → editar).
- **Llave de administración** fuera de OneDrive y de carpetas compartidas: con ella se pueden
  borrar todos los documentos saltándose las reglas. Si estuvo en un lugar sincronizado, genere una
  nueva y elimine la anterior en Google Cloud → Cuentas de servicio.
- **Plan Blaze**: si la Alcaldía puede asociar facturación, active la recuperación a un momento
  dado (7 días) y las copias programadas de Firestore; con este volumen cuesta centavos al mes.
- **Copia fuera de la nube** cada mes con `npx tsx scripts/export-backup.ts --out=E:\copias-sigecat`
  a un disco externo cifrado o carpeta institucional restringida, anotando su SHA-256.
