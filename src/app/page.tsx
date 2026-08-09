'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Utensils, LogIn, MapPin, Phone, Clock, Mail, Megaphone, Pizza, AlertCircle, Sparkles } from 'lucide-react'

type NewsItem = {
  id: string
  title: string
  content: string
  type: string
  priority: number
  publishedAt: string
}

type Product = {
  id: string
  code: string
  name: string
  description?: string | null
  price: number
  category?: string | null
  type: string
}

type Config = {
  name: string
  slogan?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  hours?: string | null
  welcomeText?: string | null
  currencySymbol?: string
}

const NEWS_COLORS: Record<string, string> = {
  INFO: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100',
  WARNING: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100',
  PROMO: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100',
  URGENT: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100',
}

const NEWS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  INFO: Megaphone,
  WARNING: AlertCircle,
  PROMO: Sparkles,
  URGENT: AlertCircle,
}

export default function HomePage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/public/config').then((r) => r.json()),
      fetch('/api/public/news').then((r) => r.json()),
      fetch('/api/public/products').then((r) => r.json()),
    ])
      .then(([c, n, p]) => {
        if (c.ok) setConfig(c.config)
        if (n.ok) setNews(n.news || [])
        if (p.ok) setProducts(p.products || [])
      })
      .finally(() => setLoading(false))
  }, [])

  // Agrupar productos por categoría
  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || 'Otros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50/30 to-slate-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/softlba-logo.svg"
              alt="SoftLBA"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl shadow-sm"
              priority
            />
            <div>
              <h1 className="text-lg font-bold leading-tight text-blue-700 dark:text-blue-300">SoftLBA</h1>
              {config?.name && (
                <p className="text-[10px] text-slate-500 hidden sm:block">{config.name}</p>
              )}
            </div>
          </div>
          <Link href="/login">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              <LogIn className="h-4 w-4 mr-1" />
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-slate-100">
            {config?.name || 'SoftLBA'}
          </h2>
          {config?.slogan && (
            <p className="mt-2 text-lg md:text-xl text-blue-600 dark:text-blue-400 font-medium">
              {config.slogan}
            </p>
          )}
          {config?.welcomeText && (
            <p className="mt-4 text-slate-600 dark:text-slate-400">{config.welcomeText}</p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            {config?.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {config.address}
              </span>
            )}
            {config?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {config.phone}
              </span>
            )}
            {config?.hours && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {config.hours}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Noticias */}
      {news.length > 0 && (
        <section className="container mx-auto px-4 py-4">
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-600" />
            Avisos y noticias
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((n) => {
              const Icon = NEWS_ICONS[n.type] || Megaphone
              return (
                <Alert key={n.id} className={NEWS_COLORS[n.type] || NEWS_COLORS.INFO}>
                  <Icon className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-sm mt-1">{n.content}</p>
                  </AlertDescription>
                </Alert>
              )
            })}
          </div>
        </section>
      )}

      {/* Productos disponibles */}
      <section className="container mx-auto px-4 py-8 flex-1">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Pizza className="h-5 w-5 text-blue-600" />
          Nuestra carta
        </h3>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-slate-500 py-12">No hay productos disponibles en este momento.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">{cat}</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{p.name}</p>
                            {p.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                            )}
                            <Badge variant="secondary" className="mt-2 text-[10px]">
                              {p.type === 'DIRECTO' ? 'Directo' : 'Elaborado'}
                            </Badge>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-blue-600 dark:text-blue-400">
                              {config?.currencySymbol || '$'}{p.price.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image
              src="/softlba-logo.svg"
              alt="SoftLBA"
              width={20}
              height={20}
              className="h-5 w-5 rounded"
            />
            <p className="font-semibold text-blue-400">SoftLBA</p>
          </div>
          <p className="text-xs">{config?.name || 'Restaurante'}</p>
          {config?.address && <p className="text-xs mt-1 text-slate-400">{config.address}</p>}
          {config?.email && (
            <p className="text-xs mt-1 flex items-center justify-center gap-1 text-slate-400">
              <Mail className="h-3 w-3" /> {config.email}
            </p>
          )}
          <p className="text-[10px] mt-3 text-slate-500">
            Sistema local · Sin dependencia de Internet · v0.6.0
          </p>
        </div>
      </footer>
    </div>
  )
}
