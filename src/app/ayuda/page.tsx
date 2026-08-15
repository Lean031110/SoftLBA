'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PanelLayout } from '@/components/layout/panel-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { toast } from 'sonner'
import { HelpCircle, Search, Pencil, ArrowLeft } from 'lucide-react'
import { ROLE_HOME, type UserRole } from '@/lib/permissions'

type HelpItem = {
  id: string
  module: string
  title: string
  content: string
  order: number
}

export default function AyudaPublicaPage() {
  const router = useRouter()
  const [items, setItems] = useState<HelpItem[]>([])
  const [role, setRole] = useState<UserRole | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch('/api/help')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setItems(d.items || [])
          setRole(d.role || '')
        } else {
          setError(d.error || 'Error al cargar')
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = q
    ? items.filter(
        (i) =>
          i.title.toLowerCase().includes(q.toLowerCase()) ||
          i.content.toLowerCase().includes(q.toLowerCase()) ||
          i.module.toLowerCase().includes(q.toLowerCase()),
      )
    : items

  // Agrupar por módulo
  const byModule: Record<string, HelpItem[]> = {}
  for (const it of filtered) {
    if (!byModule[it.module]) byModule[it.module] = []
    byModule[it.module].push(it)
  }

  function handleBack() {
    // Volver al panel según el rol
    if (role && role in ROLE_HOME) {
      router.push(ROLE_HOME[role as UserRole])
    } else {
      router.push('/login')
    }
  }

  return (
    <PanelLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="Volver al panel principal"
              className="h-10 w-10 md:h-9 md:w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <HelpCircle className="h-6 w-6 text-blue-600" />
                Centro de ayuda
              </h1>
              <p className="text-sm text-slate-500">Encuentra respuestas a tus preguntas</p>
            </div>
          </div>
          {role === 'ADMIN' && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/ayuda"><Pencil className="h-4 w-4 mr-2" /> Administrar</Link>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Busca en los artículos de ayuda..."
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : Object.keys(byModule).length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              <HelpCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No hay artículos que coincidan</p>
              <p className="text-xs mt-1">Intenta con otro término o contacta al administrador</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(byModule).map(([mod, arts]) => (
              <Card key={mod}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                    {mod}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {arts.map((a) => (
                      <AccordionItem key={a.id} value={a.id}>
                        <AccordionTrigger className="text-sm font-medium hover:no-underline">
                          {a.title}
                        </AccordionTrigger>
                        <AccordionContent>
                          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            {a.content}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center text-xs text-slate-500 py-4">
          <p>¿Necesitas más ayuda? Contacta al administrador del sistema.</p>
        </div>
      </div>
    </PanelLayout>
  )
}
