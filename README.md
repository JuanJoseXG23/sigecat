# SIGECAT

Sistema Integral de Gestión Catastral Documental para el Municipio de Girardota.

## Inicio local

```powershell
npm install
npm run dev
```

## Inicializar o rotar usuarios

El seed requiere una cuenta de servicio de Firebase Admin que no debe subirse al repositorio.
Para crear cuentas que aún no existen, define la ruta y las contraseñas nuevas sólo en la sesión
actual de PowerShell:

```powershell
$env:FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH = 'C:\ruta\segura\service-account.json'
$env:SIGECAT_SEED_ADMIN_PASSWORD = 'contraseña-nueva-y-segura'
$env:SIGECAT_SEED_COORDINATOR_PASSWORD = 'contraseña-nueva-y-segura'
$env:SIGECAT_SEED_OFFICIAL_1_PASSWORD = 'contraseña-nueva-y-segura'
$env:SIGECAT_SEED_OFFICIAL_2_PASSWORD = 'contraseña-nueva-y-segura'
npm run seed
```

El proceso es idempotente y conserva usuarios existentes. Para rotar explícitamente las
contraseñas de estas cuentas, define además:

```powershell
$env:SIGECAT_RESET_SEED_PASSWORDS = 'true'
npm run seed
```

Después de una rotación, invalida sesiones desde Firebase Authentication. Nunca guardes
contraseñas en archivos versionados, `.env.production` ni historial de terminal.

## Reglas de Firebase

`firestore.rules` exige un perfil activo para acceder a datos y limita las tareas a su
responsable. Firebase Storage no está configurado en este proyecto y no se debe habilitar hasta
implementar cargas seguras. Despliega las reglas de Firestore antes de usar estos cambios en
producción:

```powershell
firebase deploy --only firestore:rules
```

## Alertas de vencimiento por correo

Las alertas no usan Cloud Functions ni proveedores de pago. El archivo
`google-apps-script/Code.gs` se instala una sola vez en Google Apps Script y se ejecuta cada día
desde una cuenta institucional de Google Workspace. Envía únicamente a funcionarios activos que
el administrador haya habilitado en **Configuración → Alertas por correo**.

### Activación inicial

1. Inicie sesión con la cuenta institucional que enviará los correos y cree un proyecto en
   [Google Apps Script](https://script.google.com/home). Pegue el contenido de
   `google-apps-script/Code.gs` en `Code.gs` y de `google-apps-script/appsscript.json` en el
   manifiesto del proyecto (Configuración del proyecto → Mostrar archivo de manifiesto).
2. En **Configuración del proyecto → Propiedades del script**, agregue la propiedad
   `FIREBASE_PROJECT_ID` con el valor `sigecat-7c6ec`.
3. En Google Cloud Console, otorgue a esa misma cuenta institucional el rol **Cloud Datastore User**
   en el proyecto `sigecat-7c6ec`. Así el script puede leer usuarios y expedientes y registrar que
   el aviso fue enviado; no se necesita una cuenta de servicio ni una llave privada.
4. En el editor de Apps Script, seleccione y ejecute `setupDailyDeadlineAlerts`. Google pedirá
   autorización para consultar Firestore, crear el disparador y enviar correo. El disparador se
   ejecutará aproximadamente entre las 08:00 y 09:00, hora de Colombia.
5. En SIGECAT, un administrador activa **Alertas por correo** y marca los funcionarios que deben
   recibirlas. El proceso respeta el umbral de días hábiles y evita repetir una alerta para el
   mismo responsable y fecha límite.

Para comprobar la conexión antes de habilitar destinatarios, ejecute manualmente
`sendTestDeadlineAlert` desde Apps Script. El correo de prueba se envía a la cuenta institucional
que ejecuta el script y confirma también que puede consultar Firestore.

Para detener el proceso por completo, ejecute `disableDailyDeadlineAlerts` en Apps Script. Para
pausarlo sin eliminar el disparador, desactive **Alertas por correo** en SIGECAT.
