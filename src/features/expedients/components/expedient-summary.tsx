import { TimeElapsedButton } from '@/components/time-elapsed-button'
import type { FilingRecord } from '@/services/filing.service'
import type { Expedient } from '@/types/expedient'

interface ExpedientSummaryProps {
  expedient: Expedient
  filings: FilingRecord[]
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function ExpedientSummary({ expedient: item, filings }: ExpedientSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Radicación</p>
          <p className="mt-2 font-semibold">{item.numeroRadicado}</p>
          <p className="mt-1 text-sm text-slate-600">
            {item.fechaRadicado.toDate().toLocaleDateString('es-CO')}
          </p>
          <p className="text-sm text-slate-600">
            Recibido: {item.fechaRecibido?.toDate().toLocaleDateString('es-CO') ?? 'No registrado'}
          </p>
          <div className="mt-4 rounded-2xl bg-white p-3 text-sm text-slate-700 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Radicados asociados
            </p>
            {filings.length > 0 ? (
              <div className="mt-2 space-y-2">
                {filings.map((filing) => (
                  <div
                    key={filing.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="font-semibold text-slate-900">{filing.numero}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(`${filing.fecha}T00:00:00`).toLocaleDateString('es-CO')}
                    </p>
                    <p className="text-xs text-slate-500">{filing.tipo}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No hay radicados asociados todavía.</p>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Trámite y término
          </p>
          <p className="mt-2 font-semibold">{item.tipoTramite ?? 'Sin tipo'}</p>
          <p className="text-sm text-slate-600">
            Límite: {item.fechaLimite?.toDate().toLocaleDateString('es-CO') ?? 'No calculada'}
          </p>
          <div className="mt-3">
            {item.fechaRadicado && item.fechaLimite && (
              <TimeElapsedButton
                diasTranscurridos={daysSince(item.fechaRadicado.toDate())}
                estadoTermino={item.estadoTermino}
              />
            )}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gestión</p>
          <p className="mt-2 font-semibold">
            {item.funcionarioAsignado?.nombreCompleto ?? item.responsableExterno ?? 'Sin asignar'}
          </p>
          <p className="text-sm text-slate-600">Prioridad: {item.prioridad ?? 'Sin prioridad'}</p>
          <p className="text-sm text-slate-600">Ingreso: {item.medioIngreso ?? 'No registrado'}</p>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h2 className="font-semibold">Solicitantes</h2>
          <div className="mt-3 space-y-2">
            {item.solicitantes.map((applicant, index) => (
              <div
                key={`${applicant.documento}-${index}`}
                className="rounded-md border p-3 text-sm"
              >
                <b>{applicant.nombre ?? 'Sin nombre'}</b>
                <p>
                  {applicant.documento ?? 'Sin documento'} · {applicant.telefono ?? 'Sin teléfono'}
                </p>
                <p className="text-slate-500">
                  {applicant.correo ?? 'Sin correo'} · {applicant.tipoSolicitante ?? 'Sin tipo'}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-semibold">Predios</h2>
          <div className="mt-3 space-y-2">
            {item.predios.map((property, index) => (
              <div
                key={`${property.numeroPredial}-${index}`}
                className="rounded-md border p-3 text-sm"
              >
                <b>{property.municipio ?? 'Sin municipio'}</b>
                <p>{property.direccion ?? 'Sin dirección'}</p>
                <p className="text-slate-500">
                  Predial: {property.numeroPredial ?? '—'} · Matrícula:{' '}
                  {property.matriculaInmobiliaria ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div>
        <h2 className="font-semibold">Observaciones iniciales</h2>
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          {item.observacionesIniciales ?? 'Sin observaciones iniciales.'}
        </p>
      </div>
    </div>
  )
}
