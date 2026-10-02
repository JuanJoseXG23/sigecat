import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Search, UserCheck, UserX, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { Alert, EmptyState, ErrorAlert, TableSkeleton } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast-context'
import { useAuth } from '@/hooks/use-auth'
import { formatDateTime, initials, normalizeSearch } from '@/lib/format'
import { listUsers, saveUserProfile, setUserActive } from '@/services/user-profile.service'
import { USER_ROLES, type UserProfile, type UserRole } from '@/types/user'

const roleVariants: Record<UserRole, BadgeVariant> = {
  Administrador: 'violet',
  Coordinador: 'info',
  Funcionario: 'brand',
  Consulta: 'default',
}

export function UsersPage() {
  const client = useQueryClient()
  const toast = useToast()
  const { profile } = useAuth()
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers })
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [active, setActive] = useState('')
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [toggling, setToggling] = useState<UserProfile | null>(null)
  const refresh = () =>
    Promise.all(
      ['users', 'assignable-officials', 'alert-recipients', 'user-directory'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    )
  const toggle = useMutation({
    mutationFn: (user: UserProfile) => setUserActive(user, !user.activo),
    onSuccess: async (_, user) => {
      await refresh()
      setToggling(null)
      toast({ title: `${user.nombreCompleto} ${user.activo ? 'desactivado' : 'activado'}` })
    },
  })
  const save = useMutation({
    mutationFn: saveUserProfile,
    onSuccess: async (_, user) => {
      await refresh()
      setEditing(null)
      toast({ title: 'Usuario actualizado', description: user.nombreCompleto })
    },
  })
  const rows = useMemo(
    () =>
      data.filter(
        (item) =>
          normalizeSearch(`${item.nombreCompleto} ${item.correo} ${item.cargo}`).includes(
            normalizeSearch(search),
          ) &&
          (!role || item.rol === role) &&
          (!active || String(item.activo) === active),
      ),
    [active, data, role, search],
  )

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="Administración"
        title="Usuarios"
        description="Datos, rol y estado de las cuentas. Las cuentas nuevas se crean con npm run user:create (ver README)."
      />
      <ErrorAlert error={toggle.error} fallback="No fue posible cambiar el estado." />
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Nombre, correo o cargo"
            aria-label="Buscar usuarios"
          />
        </div>
        <Select
          className="md:w-48"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          aria-label="Rol"
        >
          <option value="">Todos los roles</option>
          {USER_ROLES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select
          className="md:w-44"
          value={active}
          onChange={(event) => setActive(event.target.value)}
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Select>
      </div>
      <div className="table-shell overflow-x-auto">
        <table className="data-table min-w-[820px]">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Cargo y dependencia</th>
              <th>Último acceso</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton columns={6} />}
            {rows.map((item) => (
              <tr key={item.uid} className={item.activo ? undefined : 'opacity-60'}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar className="text-xs">{initials(item.nombreCompleto)}</Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{item.nombreCompleto}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.correo}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge variant={roleVariants[item.rol]}>{item.rol}</Badge>
                </td>
                <td>
                  <p>{item.cargo}</p>
                  <p className="text-xs text-muted-foreground">{item.dependencia ?? '—'}</p>
                </td>
                <td className="text-muted-foreground">
                  {formatDateTime(item.ultimoIngreso, 'Nunca')}
                </td>
                <td>
                  <Badge variant={item.activo ? 'success' : 'default'} dot>
                    {item.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${item.nombreCompleto}`}
                      onClick={() => setEditing(item)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant={item.activo ? 'ghost-destructive' : 'ghost'}
                      size="icon"
                      disabled={item.uid === profile?.uid}
                      title={
                        item.uid === profile?.uid
                          ? 'No puedes desactivar tu propia cuenta'
                          : undefined
                      }
                      aria-label={`${item.activo ? 'Desactivar' : 'Activar'} ${item.nombreCompleto}`}
                      onClick={() => setToggling(item)}
                    >
                      {item.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !rows.length && (
          <EmptyState icon={Users} title="No hay usuarios que coincidan" />
        )}
      </div>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        busy={save.isPending}
        title="Editar usuario"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !editing?.nombreCompleto.trim() || !editing?.correo.trim() || save.isPending
              }
              onClick={() => editing && save.mutate(editing)}
            >
              {save.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ErrorAlert error={save.error} fallback="No fue posible guardar." />
            <Field label="Nombres y apellidos" required className="sm:col-span-2">
              <Input
                value={editing.nombreCompleto}
                onChange={(event) => setEditing({ ...editing, nombreCompleto: event.target.value })}
              />
            </Field>
            <Field label="Correo institucional" required className="sm:col-span-2">
              <Input
                type="email"
                value={editing.correo}
                onChange={(event) => setEditing({ ...editing, correo: event.target.value })}
              />
            </Field>
            <Field label="Cargo">
              <Input
                value={editing.cargo}
                onChange={(event) => setEditing({ ...editing, cargo: event.target.value })}
              />
            </Field>
            <Field label="Dependencia">
              <Input
                value={editing.dependencia ?? ''}
                onChange={(event) => setEditing({ ...editing, dependencia: event.target.value })}
              />
            </Field>
            <Field label="Rol" className="sm:col-span-2">
              <Select
                value={editing.rol}
                onChange={(event) =>
                  setEditing({ ...editing, rol: event.target.value as UserRole })
                }
              >
                {USER_ROLES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
            </Field>
            {editing.correo !== data.find((user) => user.uid === editing.uid)?.correo && (
              <Alert tone="warning" className="sm:col-span-2">
                Esto cambia el correo de contacto y de alertas, no el correo con el que la persona
                inicia sesión.
              </Alert>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.activo ? 'Desactivar usuario' : 'Activar usuario'}
        confirmLabel={toggling?.activo ? 'Desactivar' : 'Activar'}
        tone={toggling?.activo ? 'destructive' : 'default'}
        pending={toggle.isPending}
        onCancel={() => setToggling(null)}
        onConfirm={() => toggling && toggle.mutate(toggling)}
      >
        {toggling?.activo
          ? `${toggling.nombreCompleto} no podrá ingresar y dejará de aparecer como responsable. Sus expedientes conservan el historial.`
          : `${toggling?.nombreCompleto} podrá volver a ingresar con su contraseña actual.`}
      </ConfirmDialog>
    </section>
  )
}
