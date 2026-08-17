'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard,
  Users,
  Package,
  ChefHat,
  ShoppingCart,
  Receipt,
  Wallet,
  Archive,
  Newspaper,
  Settings,
  ScrollText,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  Sun,
  Bell,
  Utensils,
  Pizza,
  BookOpen,
  Database,
  UserCircle,
  BarChart3,
  History,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { useCurrentUser, type CurrentUser } from '@/hooks/use-current-user'
import { ROLE_LABELS, ROLE_BADGE_COLORS, type UserRole } from '@/lib/permissions'
import { RealtimeProvider } from '@/components/realtime/realtime-provider'
import { LoadingScreen } from '@/components/loading'
import { appVersionDisplay } from '@/lib/app-version'
import { useMounted } from '@/lib/use-mounted'
import { NotificationBell } from '@/components/layout/notification-bell'
import { ConnectivityBanner } from '@/components/layout/connectivity-banner'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

// FRONTEND-04 (FE-019): NAV_ITEMS agrupados en secciones lógicas para mejorar
// navegación en mobile. Antes: lista plana de 21 items que no se podía
// distinguir. Ahora: 3 secciones (Administración / Operativas / Sistema).
type NavSection = {
  title: string
  items: NavItem[]
}

const NAV_ITEMS: NavItem[] = [
  // Administración
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'CAJERO'] },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/productos', label: 'Productos', icon: Package, roles: ['ADMIN'] },
  { href: '/admin/recetas', label: 'Recetas', icon: BookOpen, roles: ['ADMIN'] },
  { href: '/admin/inventario-general', label: 'Inv. General', icon: Archive, roles: ['ADMIN'] },
  { href: '/admin/inventario', label: 'Inv. por Áreas', icon: Archive, roles: ['ADMIN', 'COCINA', 'PIZZERIA'] },
  { href: '/admin/noticias', label: 'Noticias', icon: Newspaper, roles: ['ADMIN'] },
  { href: '/admin/clientes', label: 'Clientes', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/promociones', label: 'Promociones', icon: Receipt, roles: ['ADMIN'] },
  { href: '/admin/finanzas', label: 'Finanzas', icon: Wallet, roles: ['ADMIN'] },
  { href: '/admin/cierre-diario', label: 'Cierre Diario', icon: Receipt, roles: ['ADMIN', 'CAJERO', 'MESERO_PRO'] },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ScrollText, roles: ['ADMIN'] },
  { href: '/admin/historicos', label: 'Históricos', icon: History, roles: ['ADMIN'] },
  { href: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3, roles: ['ADMIN'] },
  { href: '/admin/respaldos', label: 'Respaldos', icon: Database, roles: ['ADMIN'] },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings, roles: ['ADMIN'] },
  // Operativas
  { href: '/mesero', label: 'Mesero', icon: Utensils, roles: ['ADMIN', 'MESERO', 'MESERO_PRO'] },
  { href: '/cocina', label: 'Cocina', icon: ChefHat, roles: ['ADMIN', 'COCINA'] },
  { href: '/pizzeria', label: 'Pizzería', icon: Pizza, roles: ['ADMIN', 'PIZZERIA', 'COCINA'] },
  // Sistema
  { href: '/ayuda', label: 'Ayuda', icon: HelpCircle, roles: ['ADMIN', 'MESERO', 'MESERO_PRO', 'COCINA', 'PIZZERIA', 'CAJERO'] },
]

// Secciones para renderizar el sidebar agrupado.
function getNavSections(role: UserRole | undefined): NavSection[] {
  if (!role) return []
  const adminItems = NAV_ITEMS.filter(
    (i) => i.href.startsWith('/admin') && i.roles.includes(role),
  )
  const operativasItems = NAV_ITEMS.filter(
    (i) =>
      !i.href.startsWith('/admin') &&
      i.href !== '/ayuda' &&
      i.roles.includes(role),
  )
  const sistemaItems = NAV_ITEMS.filter(
    (i) => i.href === '/ayuda' && i.roles.includes(role),
  )

  const sections: NavSection[] = []
  if (adminItems.length > 0) {
    sections.push({ title: 'Administración', items: adminItems })
  }
  if (operativasItems.length > 0) {
    sections.push({ title: 'Operativas', items: operativasItems })
  }
  if (sistemaItems.length > 0) {
    sections.push({ title: 'Sistema', items: sistemaItems })
  }
  return sections
}

function getInitials(user: CurrentUser | null): string {
  if (!user) return '?'
  const f = user.firstName?.[0] || ''
  const l = user.lastName?.[0] || ''
  return (f + l).toUpperCase() || user.username.slice(0, 2).toUpperCase()
}

function getNavForRole(role: UserRole | undefined): NavItem[] {
  if (!role) return []
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

function SidebarNav({ user, onNavigate }: { user: CurrentUser | null; onNavigate?: () => void }) {
  const pathname = usePathname()
  // FRONTEND-04 (FE-019): renderizar por secciones para mejorar navegación.
  const sections = getNavSections(user?.role)

  return (
    <nav
      className="flex flex-col gap-3 p-3 overflow-y-auto pb-6"
      aria-label="Navegación principal"
    >
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          {/* Título de sección — visible solo en sm+ para no saturar mobile.
              En mobile los items igual funcionan; el título ayuda a entender
              la agrupación cuando hay muchos items. */}
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
            {section.title}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-10',
                  isActive
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function ThemeToggle() {
  // FE-002 (hydration mismatch): next-themes setea `class` en <html> client-side,
  // por lo que `theme` es undefined en SSR y 'light'/'dark' tras mount.
  // Antes se usaba `suppressHydrationWarning` como parche. El patrón correcto
  // es el "mounted" gate: renderiza un placeholder hasta que el cliente monte.
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) {
    // Placeholder neutro mientras SSR + primer paint del cliente coinciden.
    // Sin icono de tema hasta que next-themes determine el tema real.
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="Cargando tema…"
        className="relative h-10 w-10 md:h-9 md:w-9"
      >
        <Sun className="h-4 w-4 opacity-50" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className="relative h-10 w-10 md:h-9 md:w-9"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}

function UserMenu({ user }: { user: CurrentUser | null }) {
  const router = useRouter()
  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 text-xs font-semibold">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-xs font-medium">
              {user.firstName} {user.lastName}
            </span>
            <span className="text-[10px] text-stone-500">@{user.username}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="font-medium">{user.firstName} {user.lastName}</span>
            <span className="text-xs text-stone-500">@{user.username}</span>
            <Badge className={cn('w-fit mt-1', ROLE_BADGE_COLORS[user.role])} variant="secondary">
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/perfil')}>
          <UserCircle className="h-4 w-4 mr-2" />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/logout')}>
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('Restaurante')

  useEffect(() => {
    fetch('/api/public/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.config?.name) {
          setRestaurantName(d.config.name)
        }
      })
      .catch(() => {})
  }, [])

  // v1.0.20-rc-final: usar usePathname() directamente (sin useState/useEffect)
  // para que el título de la página se actualice tras navegación client-side.
  const panelPath = usePathname()

  // v1.1.0-rc1 (POS_RECONSTRUCTION): cuando !user && !loading, redirigir
  // a /login en vez de devolver null (pantalla en blanco).
  useEffect(() => {
    if (!loading && !user) {
      const currentPath = window.location.pathname + window.location.search
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
    }
  }, [loading, user])

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingScreen />
      </div>
    )
  }

  // user es non-null aquí gracias al guard anterior
  return (
    <RealtimeProvider userId={user.id} role={user.role}>
      {/* FRONTEND-02A (fix #2): banner de conectividad LAN/Internet.
          Se renderiza solo cuando el servidor local no responde. */}
      <ConnectivityBanner />
      {/* v1.0.20-rc-final: skip-to-content link para usuarios de teclado */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>
      <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">
        {/* Sidebar desktop */}
        <aside className="hidden md:flex w-60 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-200 dark:border-slate-800">
          <Image
            src="/softlba-logo.svg"
            alt="SoftLBA"
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg"
            priority
          />
          <div className="min-w-0">
            <p className="text-sm font-bold truncate text-blue-700 dark:text-blue-300">SoftLBA</p>
            <p className="text-[10px] text-slate-500 truncate">{restaurantName}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav user={user} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                {/* FRONTEND-04 (FE-020): h-10 (40px) en mobile, size-9 (36px) en
                    desktop. WCAG 2.5.5 recomienda 44px mínimo. */}
                <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" aria-label="Abrir menú de navegación">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="px-4 py-3 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <Image
                      src="/softlba-logo.svg"
                      alt="SoftLBA"
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-md"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-300">SoftLBA</span>
                      <span className="text-[10px] text-slate-500 font-normal">{restaurantName}</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <SidebarNav user={user} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <h1 className="text-base font-semibold hidden sm:block">
              {NAV_ITEMS.find((i) => {
                return panelPath === i.href || (i.href !== '/' && panelPath.startsWith(i.href))
              })?.label || 'Panel'}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell userId={user?.id} role={user?.role} />
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 px-4 text-center text-xs text-slate-500">
          <p className="flex items-center justify-center gap-1.5">
            <Image
              src="/softlba-logo.svg"
              alt="SoftLBA"
              width={14}
              height={14}
              className="h-3.5 w-3.5"
            />
            <span className="font-semibold text-blue-700 dark:text-blue-300">SoftLBA</span>
            {` · ${appVersionDisplay} · Sistema local para restaurante · `}
            <span className="text-slate-400">Sin dependencia de Internet</span>
          </p>
        </footer>
      </div>
    </div>
    </RealtimeProvider>
  )
}
