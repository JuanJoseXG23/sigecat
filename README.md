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
responsable. `storage.rules` bloquea Storage por completo hasta implementar cargas seguras.
Despliega ambas reglas antes de usar estos cambios en producción:

```powershell
firebase deploy --only firestore:rules,storage
```
