# SIGECAT

Sistema Integral de Gestión Catastral Documental para el Municipio de Girardota.

## Inicio local

```powershell
npm install
npm run dev
```

## Inicializar los usuarios

El seed usa Firebase Admin, por lo que requiere una cuenta de servicio del proyecto `sigecat-7c6ec`. En Firebase Console ve a **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. No subas ese archivo al repositorio.

En PowerShell, define la ruta absoluta del archivo descargado y ejecuta el seed:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\ruta\segura\service-account.json'
npm run seed
```

El script crea los usuarios de Authentication y sus perfiles en `usuarios`. Es idempotente: conserva los usuarios y perfiles que ya existen, y los informa en la consola.

## Reglas de Firestore

El archivo `firestore.rules` permite que cada usuario consulte su propio perfil, actualice únicamente `ultimoIngreso` y reserva la administración de perfiles para el rol `Administrador`. Publícalo desde Firebase Console antes de usar la autenticación en producción.
