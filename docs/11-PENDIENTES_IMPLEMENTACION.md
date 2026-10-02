# Pendientes de implementación - SIGECAT

## Motor de reglas de negocio

- Reemplazar el término provisional de 15 días hábiles por `diasRespuesta` del tipo de trámite seleccionado.
- Persistir la referencia o identificador del tipo de trámite en cada expediente, además de su nombre cuando sea necesario para consulta.
- Centralizar la consulta de tipos de trámite activos en el motor de reglas.
- Incorporar días festivos configurables al cálculo de días hábiles.
- Actualizar de manera consistente `diasRestantes` y `estadoTermino` cuando se consulte o modifique un expediente.
- Usar los umbrales centralizados para distinguir `En plazo`, `Próximo a vencer` y `Vencido`.

## Historial del expediente

- Registrar automáticamente eventos de edición general.
- Registrar cambios de estado, responsable y prioridad con valores anterior y nuevo.
- Registrar altas y bajas de solicitantes.
- Registrar altas y bajas de predios.
- Registrar la creación de observaciones.
- Crear el servicio y hook para consultar el historial cronológicamente.

## Detalle del expediente

- Conectar la ruta `/expedientes/:id` desde la tabla y la Bandeja de Trabajo.
- Completar las pestañas Resumen, Solicitantes, Predios, Observaciones, Historial y Documentos.
- Implementar CRUD de solicitantes y predios desde el detalle, manteniendo auditoría.
- Implementar observaciones inmutables en una subcolección.
- Mantener Documentos únicamente como interfaz hasta habilitar Firebase Storage.

## Tipos de trámite

- Integrar el selector de tipos de trámite en el formulario de expedientes.
- Al seleccionar un tipo, cargar sus días de respuesta y flujo de estados.
- Usar el flujo configurado para restringir o guiar cambios de estado del expediente.
- Agregar validación formal con React Hook Form y Zod al formulario administrativo de tipos de trámite.

## Bandeja de trabajo

- Incorporar filtros por estado, municipio, funcionario, tipo de trámite y prioridad.
- Agregar controles de reasignación y cambio de prioridad para Administrador y Coordinador.
- Incluir secciones específicas para vencidos, próximos a vencer, pendientes de visita y pendientes de respuesta.
- Completar el enlace Abrir con la ruta de detalle funcional.

## Calidad técnica

- Ejecutar y mantener `npm run build` y `eslint src` sin incidencias.
- Añadir pruebas unitarias para cálculos de días hábiles, umbrales y reglas de rol.
- Revisar y desplegar las reglas de Firestore después de cada cambio de colección o permiso.
