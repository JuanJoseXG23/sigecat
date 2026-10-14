# Diseño: áreas de la Secretaría y permisos

SIGECAT pasa de atender solo a Catastro a atender las siete áreas de la Secretaría de Hacienda y
Desarrollo Económico, con la misma documentación y el mismo flujo. Las decisiones están en
[decisiones.md](decisiones.md).

## Quién ve qué

| Rol                        | Ve                                              | Gestiona                                                                   |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| Administrador, Coordinador | Todo                                            | Todo                                                                       |
| Directivo                  | Todo                                            | Nada; pregunta a los responsables                                          |
| Consulta                   | Todo, en lectura                                | Nada                                                                       |
| Funcionario                | Los expedientes donde figura en `participantes` | Los que tiene asignados, y los que registró mientras no tengan responsable |

Quien tuvo un expediente antes lo sigue viendo, pero ya no actúa sobre él. La restricción se
impone en `firestore.rules`, no solo en la interfaz.

## Modelo

- `src/lib/dependencies.ts`: catálogo fijo de áreas con id estable.
- `usuarios.dependencia` y, con las reglas nuevas, `directorioUsuarios.dependencia`: id del área.
- `expedientes.dependencia`: área que lidera. Sin el campo, Catastro.
- `expedientes.participantes[]`: quienes lo registraron, lo tuvieron asignado o actuaron sobre
  él. Las reglas no pueden buscar en el historial, pero sí comprobar si un uid está en la lista.
  Solo crece.
- `radicados.dependencia` y `radicados.participantes[]`: copia, para restringir Radicación igual.
- `expedientes.fechaCierre` en los cerrados antiguos: permite consultar el Histórico por periodo.

## Despliegue por pasos

| Paso | Contenido                                                                                                                                 | Estado                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1    | Validación del formato de radicados (`src/lib/filing-number.ts`)                                                                          | Hecho                         |
| 2    | Se escriben `dependencia` y `participantes`; área en formulario, Usuarios, tablas y filtros por área. Las reglas actuales siguen vigentes | Hecho                         |
| 3    | Copia de seguridad y migración de datos existentes (`scripts/migrate-dependencies.ts`): simulación, revisión y aplicación                 | Script listo; sin ejecutar    |
| 4    | Reglas nuevas probadas en el emulador                                                                                                     | Pendiente (requiere Java 11+) |
| 5    | Consultas del Funcionario por `participantes` y publicación de reglas e índices: aquí cambia la visibilidad                               | Pendiente                     |
| 6    | Histórico, Reportes, Biblioteca y Radicación consultan por periodo                                                                        | Pendiente                     |
| 7    | Pasar expedientes entre áreas y colaboración entre áreas                                                                                  | Pendiente                     |

El paso 5 solo se publica después del 3: si las consultas por `participantes` salieran antes de
la migración, los Funcionarios dejarían de ver los expedientes antiguos.

## Reglas nuevas (paso 5)

- Expedientes: leer si el rol ve todo o si `request.auth.uid in resource.data.participantes`.
  Crear exige que quien crea esté en `participantes` y que el área sea del catálogo. Actualizar
  exige que `participantes` no pierda a nadie y que el nuevo responsable quede incluido.
- Historial: se lee como su expediente; solo escribe quien puede gestionar el expediente (hoy
  cualquier usuario operativo puede escribir en cualquier historial).
- Radicados: se leen si el rol ve todo o si el usuario está en su copia de `participantes`; crear
  exige poder gestionar el expediente.
- Directorio: admite `dependencia`.
- En Firestore las reglas no filtran: cada consulta del Funcionario debe pedir exactamente
  `where('participantes', 'array-contains', uid)`, o se rechaza completa.

## Reversión

- Pasos 1, 2 y 6: revertir el commit; los campos nuevos no afectan a la versión anterior.
- Paso 3: restaurar desde la copia JSON que el script guarda antes de escribir.
- Paso 5: volver a desplegar la versión anterior de `firestore.rules`.
