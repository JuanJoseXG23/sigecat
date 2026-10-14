import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Handshake } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EXPEDIENT_QUERIES } from '@/features/expedients/expedient-queries'
import { useAuth } from '@/hooks/use-auth'
import { DEPENDENCIES, toDependencyId } from '@/lib/dependencies'
import { normalizeSearch } from '@/lib/format'
import {
  EMPTY_RESPONSE_SUPPORT,
  getResponseSupportError,
  MAX_SUPPORT_DESCRIPTION,
} from '@/lib/response-support'
import { addResponseSupport } from '@/services/expedient.service'
import { listDirectory } from '@/services/user-profile.service'
import type { Expedient } from '@/types/expedient'

interface SupportDialogProps {
  expedient: Expedient
  onClose: () => void
  onCompleted: () => void
}

/** Registra que otra área (o persona) apoyó la respuesta, sin cambiar el responsable. */
export function SupportDialog({ expedient, onClose, onCompleted }: SupportDialogProps) {
  const { user } = useAuth()
  const client = useQueryClient()
  const { data: directory = [] } = useQuery({
    queryKey: ['user-directory'],
    queryFn: listDirectory,
  })
  const [values, setValues] = useState(EMPTY_RESPONSE_SUPPORT)
  const people = directory.filter((entry) => entry.activo)
  const linked = people.find(
    (entry) => normalizeSearch(entry.nombreCompleto) === normalizeSearch(values.persona),
  )
  const input = { ...values, personaUid: linked?.uid }
  const missing = getResponseSupportError(input)

  const choosePerson = (persona: string) => {
    const match = people.find(
      (entry) => normalizeSearch(entry.nombreCompleto) === normalizeSearch(persona),
    )
    const area = toDependencyId(match?.dependencia)
    setValues({ ...values, persona, ...(area && !values.dependencia ? { dependencia: area } : {}) })
  }

  const save = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.')
      return addResponseSupport(expedient.id, input, user.uid)
    },
    onSuccess: async () => {
      await Promise.all(
        EXPEDIENT_QUERIES.map((key) => client.invalidateQueries({ queryKey: [key] })),
      )
      onCompleted()
    },
  })

  return (
    <Dialog
      open
      onClose={onClose}
      busy={save.isPending}
      kicker={`Radicado ${expedient.numeroRadicado}`}
      title="Apoyo en respuesta"
      description="Deja constancia de quién apoyó la respuesta y en qué. El expediente sigue en su área y con su responsable."
      footer={
        <>
          {missing && (
            <p className="text-sm text-muted-foreground sm:mr-auto">
              <span className="font-medium text-amber-700">Falta:</span> {missing}
            </p>
          )}
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button disabled={save.isPending || Boolean(missing)} onClick={() => save.mutate()}>
            <Handshake size={17} />
            {save.isPending ? 'Guardando…' : 'Registrar apoyo'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorAlert error={save.error} fallback="No fue posible registrar el apoyo." />
        <Field
          label="Persona encargada"
          required
          hint={
            linked
              ? `${linked.nombreCompleto} tiene usuario: podrá consultar el expediente, no modificarlo.`
              : 'Elige un usuario de la lista o escribe el nombre si no tiene cuenta.'
          }
        >
          <Input
            list="support-people"
            value={values.persona}
            onChange={(event) => choosePerson(event.target.value)}
            placeholder="Nombre completo"
          />
          <datalist id="support-people">
            {people.map((entry) => (
              <option key={entry.uid} value={entry.nombreCompleto} />
            ))}
          </datalist>
        </Field>
        <Field label="Área que apoyó" required>
          <Select
            value={values.dependencia}
            onChange={(event) => setValues({ ...values, dependencia: event.target.value })}
          >
            <option value="">Selecciona el área</option>
            {DEPENDENCIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="En qué apoyó"
          required
          hint={`${values.descripcion.trim().length}/${MAX_SUPPORT_DESCRIPTION} caracteres.`}
        >
          <Textarea
            value={values.descripcion}
            maxLength={MAX_SUPPORT_DESCRIPTION}
            onChange={(event) => setValues({ ...values, descripcion: event.target.value })}
            placeholder="Ej. Respondió el punto 3 sobre el estado de cuenta del impuesto predial."
          />
        </Field>
      </div>
    </Dialog>
  )
}
