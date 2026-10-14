# Cumplimiento normativo de SIGECAT

Revisión de octubre de 2026 de las normas colombianas que aplican a SIGECAT como sistema de una
entidad pública que trata datos personales de ciudadanos. **No es un concepto jurídico**: separa lo
que dicen las normas (verificado en su texto o en fuentes oficiales, citadas al final) de las buenas
prácticas, y señala lo que debe confirmar la Oficina Jurídica de la Alcaldía.

## Resumen

| Tema                                | Obligación                                                                                                  | Estado en SIGECAT                                                                        | Qué falta                                                                                                  | Quién                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| Autorización de los ciudadanos      | No se requiere: la entidad pública trata los datos en ejercicio de sus funciones (Ley 1581, art. 10 lit. a) | Cumple                                                                                   | Informar el uso en el aviso de privacidad de la Alcaldía                                                   | Jurídica               |
| Acceso restringido y seguridad      | Principios de la Ley 1581, art. 4                                                                           | Cumple: reglas por rol y área probadas, historial inmutable, copias diarias              | Verificación en dos pasos (no disponible hoy)                                                              | —                      |
| Registro Nacional de Bases de Datos | Obligatorio para personas jurídicas públicas (Decreto 090 de 2018)                                          | **Pendiente**                                                                            | Inscribir la base de SIGECAT, o incluirla en el registro de la Alcaldía                                    | Oficial de datos       |
| Reporte de incidentes               | Reportar a la SIC dentro de 15 días hábiles                                                                 | Cumple: paso 4 de la guía de emergencia                                                  | —                                                                                                          | —                      |
| Alojamiento fuera de Colombia       | Solo en países con nivel adecuado, con contrato de transmisión con el encargado                             | Brasil y EE. UU. son adecuados; **el contrato con Google lo aceptó una cuenta personal** | Pasar el proyecto a una cuenta institucional y aceptar allí los términos de tratamiento de datos de Google | Responsable de SIGECAT |
| Derecho de petición                 | Términos, ampliación hasta el doble, traslado en 5 días (Ley 1755 de 2015)                                  | Cumple: implementado y probado                                                           | —                                                                                                          | —                      |
| Transparencia                       | Registro de Activos de Información e Índice de Información Clasificada (Ley 1712, arts. 13 y 20)            | **Pendiente**                                                                            | Incluir SIGECAT y sus datos personales en ambos instrumentos                                               | Planeación / TIC       |
| Gestión documental                  | Ley 594 de 2000, Decreto 1080 de 2015, Acuerdo AGN 001 de 2024                                              | SIGECAT es herramienta de seguimiento; el archivo está en físico y OneDrive              | Dejar constancia formal con Archivo de que SIGECAT no es el archivo oficial                                | Archivo                |
| Seguridad digital                   | Política de Gobierno Digital (Decreto 767 de 2022) y MSPI (Resolución 500 de 2021)                          | Aporta controles de acceso, auditoría y copias                                           | Incluir SIGECAT en el inventario de activos y la matriz de riesgos del MSPI                                | TIC                    |

## 1. Protección de datos personales (Ley 1581 de 2012 y Decreto 1074 de 2015)

**Autorización.** El artículo 10, literal a, exime de autorización cuando se trata de "información
requerida por una entidad pública o administrativa en ejercicio de sus funciones legales". Atender
derechos de petición es una función legal, así que SIGECAT no necesita pedir autorización a los
peticionarios. La Corte Constitucional (sentencia C-748 de 2011) condiciona esa excepción a que la
entidad: guarde la confidencialidad, **informe al titular el uso** que da a sus datos y los conserve
con seguridad.

- _Cumple:_ confidencialidad y seguridad (ver más abajo).
- _Falta:_ que el aviso de privacidad o la política de tratamiento de la Alcaldía mencionen que los
  datos de quien presenta una petición se registran en un sistema de seguimiento.

**Acceso restringido y seguridad (art. 4).** SIGECAT aplica en el servidor (`firestore.rules`) que
cada Funcionario solo ve lo que pasó por él. Las reglas se prueban en cada publicación; el
historial no se puede editar ni borrar, los expedientes no se borran y hay copia diaria con
procedimiento de recuperación probado. _Buena práctica pendiente:_ verificación en dos pasos para
las cuentas con acceso total.

**Registro Nacional de Bases de Datos (RNBD).** El Decreto 090 de 2018 obliga a inscribirse a las
"personas jurídicas de naturaleza pública". La Alcaldía debe tener inscritas sus bases; la de SIGECAT
(peticionarios: nombre, documento, teléfono, correo) debe figurar ahí. _Confirmar con el oficial de
protección de datos de la Alcaldía_ si ya está o si hay que agregarla.

**Incidentes de seguridad.** La Circular Única de la SIC exige reportar en el RNBD, dentro de los
**15 días hábiles** siguientes a conocerlos, las violaciones de seguridad o accesos no autorizados a
una base de datos. _Cumple:_ la [guía de emergencia](EMERGENCIA-recuperacion.md) lo incluye como
primer aviso cuando el incidente es un acceso indebido.

**Alojamiento en el exterior.** Firestore está en `southamerica-east1` (São Paulo, Brasil) y la
operan Google LLC y Google Cloud, que actúan como **encargados** del tratamiento.

- _Países:_ la lista de la SIC (Circular 008 de 2017, numeral 3.2 del Título V de la Circular Única)
  incluye a Estados Unidos y "los países que han sido declarados con el nivel adecuado de protección
  por la Comisión Europea". La Comisión declaró adecuado a Brasil en enero de 2026 (Decisión de
  Ejecución 2026/179). Por esa vía, Brasil queda cubierto; la SIC además estudia incluirlo
  directamente (proyecto de 2026). _Interpretación para confirmar con Jurídica._
- _Contrato:_ una transmisión internacional a un encargado no requiere informar al titular **si hay
  un contrato de transmisión** en los términos del artículo 2.2.2.25.5.2 del Decreto 1074 de 2015.
  Google ofrece esos términos (anexo de tratamiento de datos de Google Cloud), pero hoy el proyecto
  de Firebase pertenece a una **cuenta personal de Gmail**: quien los aceptó es una persona, no la
  Alcaldía. **Es la brecha más importante de esta revisión.** Solución: crear una cuenta de Google con
  un correo `@girardota.gov.co`, hacerla propietaria del proyecto y aceptar desde ella los términos
  de tratamiento de datos.

## 2. Derecho de petición (Ley 1437 de 2011, sustituida por la Ley 1755 de 2015)

Implementado y con pruebas automáticas:

- Términos en días hábiles según el tipo de trámite, con festivos de Colombia.
- Ampliación antes del vencimiento, informada al peticionario con radicado, sin exceder el doble del
  término inicial (art. 14, parágrafo).
- Traslado por competencia; si se registra después de 5 días hábiles se advierte (art. 21).
- Oportunidad medida con la fecha real del radicado de respuesta.

## 3. Transparencia (Ley 1712 de 2014)

Todo sujeto obligado debe mantener un **Registro de Activos de Información** (art. 13) y un **Índice
de Información Clasificada y Reservada** (art. 20). SIGECAT es un activo de información, y los datos
personales de los peticionarios son información clasificada. _Falta_ que Planeación o TIC los
incluyan en ambos instrumentos de la Alcaldía.

## 4. Gestión documental (Ley 594 de 2000, Decreto 1080 de 2015, Acuerdo AGN 001 de 2024)

SIGECAT **no guarda los documentos**: guarda enlaces a OneDrive institucional y exige el formato
físico firmado. Funciona como herramienta de control y seguimiento, no como Sistema de Gestión de
Documentos Electrónicos de Archivo (SGDEA). Esto importa porque un SGDEA debe cumplir los requisitos
del Acuerdo 001 de 2024 (expediente electrónico, metadatos, índice electrónico, preservación y
aplicación de las Tablas de Retención Documental).

- _Recomendación:_ dejar constancia con Archivo de que el expediente oficial es el físico y el de
  OneDrive, y SIGECAT su registro de seguimiento.
- _Si algún día SIGECAT debe ser el archivo oficial,_ habría que retomar la clasificación por TRD
  (se retiró en octubre de 2026) y agregar metadatos y preservación.
- _Ya cumple:_ SIGECAT no borra expedientes ni historial, compatible con la conservación que
  definan las TRD.

## 5. Seguridad digital (Decreto 767 de 2022 y Resolución 500 de 2021 de MinTIC)

La Política de Gobierno Digital y el Modelo de Seguridad y Privacidad de la Información (MSPI) se
aplican a la entidad, no a cada sistema. SIGECAT aporta controles: acceso por rol y área en el
servidor, registro de auditoría, copias diarias y recuperación probada, pruebas automáticas de las
reglas. Pendientes desde el MSPI:

- Incluir SIGECAT en el inventario de activos y en la matriz de riesgos.
- Gestión de llaves: hay dos llaves de administración activas y una está en una carpeta de
  descargas. Eliminar la que no se usa y guardar la otra fuera de OneDrive.
- Activar la protección contra eliminación de la base de Firestore.
- Continuidad: que el proyecto no dependa de una sola cuenta personal.

## Acciones, por prioridad

1. **Propiedad institucional** del proyecto de Firebase y aceptación de los términos de tratamiento
   de datos de Google a nombre de la Alcaldía. Responsable de SIGECAT.
2. **RNBD:** confirmar que la base de peticionarios esté inscrita. Oficial de protección de datos.
3. **Llaves y protección contra eliminación.** Responsable de SIGECAT.
4. **Aviso de privacidad:** mencionar el registro de las peticiones en un sistema de seguimiento.
   Jurídica.
5. **Registro de Activos e Índice de Información Clasificada** (Ley 1712). Planeación / TIC.
6. **Constancia con Archivo** de que SIGECAT es herramienta de seguimiento. Archivo.
7. **MSPI:** inventario y matriz de riesgos. TIC.

## Fuentes

- [Circular Externa SIC 008 de 2017 (lista de países con nivel adecuado)](https://normativa.colpensiones.gov.co/colpens/docs/circular_superindustria_0008_2017.htm)
- [Circular Externa SIC 005 de 2017](https://operaciones.colombiacompra.gov.co/sites/cce_public/files/cce_informe_seguimiento/superindustria-circularexterna-2017-n0000005_20170810_1.pdf)
- [Decisión de Ejecución (UE) 2026/179 sobre Brasil](https://eur-lex.europa.eu/eli/dec_impl/2026/179/oj/eng) y [análisis de Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2026/02/a-new-era-for-personal-data-transfers-brazil-and-european-union-establish-mutual-adequacy-decision)
- [Asuntos Legales: candidatos a la lista de la SIC (2026)](https://www.asuntoslegales.com.co/analisis/sofia-navas-vera-4325984/brasil-ecuador-kenia-panama-y-sudafrica-los-nuevos-candidatos-a-la-lista-de-paises-con-proteccion-adecuada-de-datos-personales-4417427)
- [Decreto 090 de 2018 (RNBD)](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=85039)
- [Ley 1581 de 2012, art. 10 y sentencia C-748 de 2011 (Actualícese)](https://actualicese.com/entidades-publicas-no-requieren-autorizacion-para-el-tratamiento-de-datos-personales/)
- [Decreto 1377 de 2013 (transmisión internacional)](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/pdf/decreto_1377_2013.pdf)
- [Reporte de incidentes al RNBD (Forvis Mazars)](https://www.forvismazars.com/co/es/acerca-de-nosotros/noticias-publicaciones-y-media/nuestras-noticias-y-publicaciones/actualidad-juridica-y-tributaria/2021/reporte-de-novedades-por-incidentes-de-seguridad)
- [Acuerdo AGN 001 de 2024](https://normativa.colpensiones.gov.co/compilacion/docs/acuerdo_archivo_0001_2024.htm)
- [Decreto 767 de 2022 (Política de Gobierno Digital)](https://gobiernodigital.mintic.gov.co/692/articles-272977_Decreto_767_2022.pdf)
- Ley 1712 de 2014, arts. 13 y 20; Ley 1755 de 2015, arts. 14 y 21; Ley 594 de 2000; Decreto 1080 de 2015; Resolución MinTIC 500 de 2021.
