import {
  ArrowRight,
  CalendarPlus,
  Eye,
  FilePlus2,
  FolderOpen,
  Handshake,
  History,
  Mail,
  ShieldQuestion,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { APP_NAME, SECRETARIAT } from '@/app/branding'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'

/** Pasos del flujo estándar, en el orden en que avanza un expediente. */
const STEPS: { status: string; detail: string }[] = [
  {
    status: 'Recibido',
    detail:
      'Confirma que el formato físico está firmado y asocia el documento recibido de OneDrive.',
  },
  { status: 'Asignado', detail: 'Elige el responsable; le llega un correo.' },
  {
    status: 'En respuesta',
    detail:
      'Elige: responder al ciudadano, trasladar por competencia a otra entidad o cambiar de responsable.',
  },
  {
    status: 'Radicado de salida',
    detail: 'Asocia la respuesta radicada y escribe su número (serie 200) y su fecha.',
  },
  { status: 'Archivo (Finalizado)', detail: 'El expediente se cierra y pasa al Histórico.' },
]

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
}) {
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <Icon size={18} className="text-primary" /> {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{children}</div>
    </Card>
  )
}

/** Guía rápida para quien empieza a usar SIGECAT, en cualquier área de la Secretaría. */
export function HelpPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        kicker="Ayuda"
        title={`Guía rápida de ${APP_NAME}`}
        description={`Cómo registrar, gestionar y responder los expedientes de la ${SECRETARIAT}. Cada área trabaja la misma documentación con el mismo flujo.`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={Eye} title="Qué ves">
          <p>
            Como <b>Funcionario</b> ves los expedientes que registraste, los que tienes asignados y
            los que tuviste antes. Solo puedes actuar sobre los que tienes asignados ahora.
          </p>
          <p>
            Administración, Coordinación, la Dirección y Consulta ven todos los expedientes de la
            Secretaría. Usa el filtro <b>Área</b> para ver una sola.
          </p>
        </Section>

        <Section icon={FilePlus2} title="Registrar un expediente">
          <p>
            En <b>Expedientes → Radicar expediente</b>. El área queda automáticamente en la tuya.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Radicado de entrada</b> tal como lo asignó Archivo: año + 100 + consecutivo (por
              ejemplo <code>20261000125</code>).
            </li>
            <li>
              El <b>tipo de trámite</b> define los días hábiles para responder.
            </li>
            <li>Los predios son opcionales: solo si el trámite se refiere a uno.</li>
            <li>Si eliges otro responsable, le llega un correo.</li>
          </ul>
        </Section>
      </div>

      <Section icon={ArrowRight} title="Avanzar el expediente">
        <p>
          En el detalle del expediente, el botón principal muestra el paso siguiente y pide solo lo
          que falta:
        </p>
        <ol className="mt-2 space-y-2">
          {STEPS.map((step, index) => (
            <li key={step.status} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              <span>
                <b className="text-slate-900">{step.status}:</b> {step.detail}
              </span>
            </li>
          ))}
        </ol>
        <p className="pt-1">
          Todo lo que se envía usa la serie 200 de Archivo: respuestas, traslados y ampliaciones
          (por ejemplo <code>20262000321</code>).
        </p>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={CalendarPlus} title="Plazos">
          <p>
            El semáforo indica si está <b>en plazo</b>, <b>próximo a vencer</b> o <b>vencido</b>, en
            días hábiles (sin fines de semana ni festivos).
          </p>
          <p>
            Si no alcanzas a responder, usa <b>Ampliar plazo</b> antes del vencimiento, con el
            oficio radicado que se envió al ciudadano. El plazo total no puede pasar del doble del
            inicial (Ley 1755 de 2015).
          </p>
        </Section>

        <Section icon={Handshake} title="Apoyo de otra área">
          <p>
            Si parte de la petición la responde otra área, usa <b>Apoyo en respuesta</b> en el
            detalle: quién apoyó, de qué área y en qué. El expediente sigue en tu área y contigo
            como responsable.
          </p>
          <p>Si esa persona tiene usuario, podrá consultar el expediente, pero no modificarlo.</p>
        </Section>

        <Section icon={History} title="Algo que no subiste a tiempo">
          <p>
            Si respondiste, trasladaste o ampliaste en la oficina pero no lo registraste, usa{' '}
            <b>Registrar atrasado</b>: pide las fechas reales de cada radicado y deja constancia del
            motivo.
          </p>
        </Section>

        <Section icon={FolderOpen} title="Documentos">
          <p>
            Los escaneos se guardan en el <b>OneDrive institucional</b>; SIGECAT guarda el enlace.
            En la pestaña <b>Documentos</b> del expediente están todos, en orden, con la hoja de
            control para imprimir.
          </p>
        </Section>

        <Section icon={Mail} title="Correos que recibes">
          <ul className="list-disc space-y-1 pl-5">
            <li>Cuando te asignan un expediente.</li>
            <li>Cuando un expediente tuyo está por vencer (si tienes las alertas activas).</li>
            <li>
              Cuando la Dirección pregunta por un expediente tuyo: respóndele directamente desde el
              correo.
            </li>
          </ul>
        </Section>

        <Section icon={ShieldQuestion} title="Si algo no funciona">
          <p>
            Si no ves un expediente, es porque no pasó por ti: pide a Coordinación que te lo asigne
            o que registre tu apoyo.
          </p>
          <p>
            Para crear cuentas, cambiar tu área o tu rol, o cualquier error, comunícate con el
            Administrador de {APP_NAME}.
          </p>
        </Section>
      </div>
    </section>
  )
}
