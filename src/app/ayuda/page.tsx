'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { toast } from 'sonner'
import { HelpCircle, Search, ArrowLeft, Pencil } from 'lucide-react'

type HelpItem = {
  id: string
  module: string
  title: string
  content: string
  order: number
}

export default function AyudaPublicaPage() {
  const [items, setItems] = useState<HelpItem[]>([])
  const [role, setRole] = useState<string>('')
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

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950">
      <header className="border-b bg-white dark:bg-stone-900 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-orange-600" />
              Centro de ayuda
            </h1>
          </div>
          {role === 'ADMIN' && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/ayuda"><Pencil className="h-4 w-4 mr-2" /> Administrar</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
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
            <CardContent className="p-10 text-center text-stone-500">
              <HelpCircle className="h-12 w-12 mx-auto mb-3 text-stone-300" />
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
                    <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
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
                          <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
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
      </main>

      <footer className="mt-auto border-t bg-white dark:bg-stone-900 py-3 px-4 text-center text-xs text-stone-500">
        <p>¿Necesitas más ayuda? Contacta al administrador del sistema.</p>
      </footer>
    </div>
  )
}
