# Arquitectura

SIGECAT es una aplicación de una sola página (SPA) sin servidor propio: el navegador habla
directamente con Firebase, y la seguridad la aplican las reglas de Firestore.

```
Navegador (React)  ──►  Firebase Auth + Firestore  ◄──  Google Apps Script (correos)
        ▲                       ▲
GitHub Pages            firestore.rules
```

## Stack

| Área          | Herramienta                                                |
| ------------- | ---------------------------------------------------------- |
| Interfaz      | React 19, TypeScript (strict), Tailwind CSS, Lucide        |
| Datos y caché | TanStack Query sobre el SDK web de Firebase                |
| Formularios   | React Hook Form + Zod                                      |
| Rutas         | React Router con `createHashRouter`                        |
| Autenticación | Firebase Authentication (correo y contraseña)              |
| Base de datos | Cloud Firestore                                            |
| Correos       | Google Apps Script con la cuenta institucional             |
| Documentos    | Enlaces a OneDrive/SharePoint (no se usa Firebase Storage) |
| Publicación   | GitHub Pages mediante GitHub Actions                       |

## Carpetas

```
src/
  app/          Proveedores globales (QueryClient, AuthProvider, Router)
  routes/       Rutas y menú; cada ruta declara los roles que la pueden ver
  layouts/      Marco de la aplicación (barra lateral, encabezado)
  pages/        Una página por ruta
  features/     Piezas propias de un módulo (auth, formulario de expedientes)
  components/   Componentes compartidos; ui/ contiene los básicos (botón, diálogo, campos,
                avisos, toasts) con la paleta institucional de globals.css
  hooks/        Hooks de TanStack Query que envuelven los servicios
  services/     Único lugar que accede a Firestore
  lib/          Lógica pura y probada: días hábiles y festivos, ampliación de plazo, correcciones,
                permisos, enlaces, CSV y formatos de fecha
  types/        Modelos de datos
scripts/        Tareas administrativas con firebase-admin (crear usuarios, seed)
google-apps-script/  Proceso de correos que se pega en script.google.com
```

## Convenciones

- **Capas.** Las páginas usan hooks; los hooks usan servicios; solo los servicios importan
  `firebase/firestore`.
- **Idioma.** Los identificadores del código van en inglés; los campos de Firestore y los textos de
  la interfaz, en español.
- **Escrituras atómicas.** Toda acción sobre un expediente se guarda en un `writeBatch` que incluye
  su registro de historial (y, si aplica, el radicado y el aviso por correo). O se guarda todo o
  nada.
- **Permisos duplicados a propósito.** `src/lib/permissions.ts` decide qué botones ve el usuario y
  `firestore.rules` hace cumplir lo mismo en el servidor. Si cambia uno, debe cambiar el otro.
- **Lecturas acotadas.** Cada pantalla consulta solo lo que muestra (activos, finalizados, lo
  asignado al Funcionario, los radicados de un expediente). TanStack Query conserva los
  resultados un minuto y las acciones invalidan lo que modifican; la configuración de términos se
  guarda cinco minutos en memoria.
- **Carga diferida.** Cada página se descarga al visitarla (`src/routes/router.tsx`); React y
  Firebase van en archivos aparte que el navegador conserva entre publicaciones.
- **Nada se borra.** Los expedientes se finalizan o archivan, y el historial es de solo escritura.
- **Interfaz.** Las ventanas usan `Dialog` (Escape, foco atrapado, hoja inferior en celular), las
  confirmaciones `ConfirmDialog` (nunca `window.confirm`) y los avisos de éxito `useToast`. Los
  colores salen de los tokens de `src/styles/globals.css` (paleta de la Alcaldía de Girardota).
- **Exportaciones.** `src/lib/csv.ts` genera CSV con `;` y BOM para que Excel en español muestre
  bien columnas y tildes.
- **Formato.** Prettier y ESLint; los finales de línea son LF (`.gitattributes`).

## Calidad y publicación

Cada `push` a `main` ejecuta, en este orden: lint, verificación de formato, pruebas y build. Si
algo falla, no se publica. La URL es `https://juanjosexg23.github.io/sigecat/`; por eso
`vite.config.ts` usa `base: '/sigecat/'` y las rutas usan `#` (GitHub Pages no reescribe URLs).

Comandos locales:

```powershell
npm run dev            # servidor de desarrollo
npm run lint
npm run format         # aplica Prettier
npm test               # pruebas de src/lib
npm run build
```

Las reglas de Firestore **no** se publican con el `push`; se despliegan aparte con
`firebase deploy --only firestore:rules --project sigecat-7c6ec`.
