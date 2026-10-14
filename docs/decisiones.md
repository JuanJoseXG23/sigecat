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

| ID   | Decisión                                                                                                             | Estado     |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| D-07 | El Funcionario ve y responde lo que se le asigna o pasó por él; los usuarios mayores ven todo                        | Confirmada |
| D-11 | Ven todo: Administrador, Coordinador y Directivo                                                                     | Confirmada |
| D-12 | No hay coordinadores por área. Jefatura: Diana. Coordinan la documentación: Juan José y Emanuel                      | Confirmada |
| D-13 | El funcionario asignado registra todo en SIGECAT                                                                     | Confirmada |
| D-14 | Quien registra un expediente cuenta como alguien por quien pasó                                                      | Confirmada |
| D-15 | Los expedientes sin responsable los ven los usuarios mayores y quien los registró                                    | Confirmada |
| D-16 | Los Funcionarios de Catastro dejan de ver los expedientes de sus compañeros                                          | Confirmada |
| D-17 | Un expediente puede cambiar de área o tener respuestas compartidas                                                   | Confirmada |
| D-18 | Cada funcionario pertenece a una sola área                                                                           | Confirmada |
| D-19 | Todos los expedientes existentes son de Catastro                                                                     | Confirmada |
| D-23 | Consulta ve todo en lectura                                                                                          | Delegada   |
| D-24 | Los coordinadores coordinan la documentación de toda la Secretaría                                                   | Delegada   |
| D-25 | Diana: Directivo. Juan José: Administrador                                                                           | Delegada   |
| D-26 | El expediente queda asignado a quien lo registra si no elige otro responsable                                        | Delegada   |
| D-27 | Respuesta compartida: un área lidera y responde; las demás colaboran                                                 | Delegada   |
| D-28 | ~~Pasar expedientes entre áreas~~: reemplazada por D-34                                                              | Descartada |
| D-29 | Los tipos de trámite son comunes a todas las áreas                                                                   | Delegada   |
| D-31 | Solo actúa el responsable actual; quienes lo tuvieron antes solo consultan                                           | Delegada   |
| D-32 | Catálogo de áreas fijo en el código (`src/lib/dependencies.ts`)                                                      | Delegada   |
| D-33 | Los Funcionarios ven en Radicación solo los radicados de sus expedientes                                             | Delegada   |
| D-34 | Apoyo en respuesta: se registra quién de otra área apoyó y en qué; el expediente no cambia de área ni de responsable | Confirmada |

## Predios

| ID   | Decisión                                                                                                 | Estado |
| ---- | -------------------------------------------------------------------------------------------------------- | ------ |
| D-10 | Predios opcionales en los expedientes nuevos; los históricos se conservan; se quita la columna Municipio | Hecha  |

## Pendientes

- Tipos de solicitante "Propietario" y "Copropietario": ¿se mantienen para todas las áreas?
- Copias de seguridad: el código está listo (README); falta activarlo en Apps Script.
- Normativa aplicable (Ley 1581 de 2012, Ley 594 de 2000, Decreto 1080 de 2015, Ley 1712 de
  2014): separar obligaciones verificadas de buenas prácticas.
- D-26: hoy el formulario permite dejar el expediente sin responsable; falta decidir si se asigna
  solo a quien lo registra.
