import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import shield from '@/img/Escudo_de_Girardota.webp'

export function AuthLayout() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flag-stripe absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
        <div
          className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-primary/40 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-brand-vitalidad/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-white p-2 shadow-lg">
            <img src={shield} alt="" className="size-full object-contain" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/70">Alcaldía de Girardota</p>
            <p className="text-sm text-white/50">Secretaría de Hacienda · Catastro</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-juventud">
            SIGECAT
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight">
            Gestión catastral documental, clara y a tiempo.
          </h1>
        </div>
        <p className="relative text-xs text-white/40">
          Municipio de Girardota, Antioquia · Sistema Integral de Gestión Catastral Documental
        </p>
      </section>

      <section className="flex items-center justify-center bg-background p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-white p-2 shadow-lg shadow-emerald-950/10 ring-1 ring-border">
              <img
                src={shield}
                alt="Escudo del Municipio de Girardota"
                className="size-full object-contain"
              />
            </div>
            <p className="text-2xl font-bold text-slate-900">SIGECAT</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sistema Integral de Gestión Catastral Documental
            </p>
          </div>
          <Suspense>
            <Outlet />
          </Suspense>
        </div>
      </section>
    </main>
  )
}
