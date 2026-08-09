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
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { useCurrentUser, type CurrentUser } from '@/hooks/use-current-user'
import { ROLE_LABELS, ROLE_BADGE_COLORS, type UserRole } from '@/lib/permissions'
import { NotificationBell } from '@/components/layout/notification-bell'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  // Admin
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'CAJERO'] },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/productos', label: 'Productos', icon: Package, roles: ['ADMIN'] },
  { href: '/admin/recetas', label: 'Recetas', icon: BookOpen, roles: ['ADMIN'] },
  { href: '/admin/inventario-general', label: 'Inv. General', icon: Archive, roles: ['ADMIN'] },
  { href: '/admin/inventario', label: 'Inv. por Áreas', icon: Archive, roles: ['ADMIN', 'COCINA', 'PIZZERIA'] },
  { href: '/admin/noticias', label: 'Noticias', icon: Newspaper, roles: ['ADMIN'] },
  { href: '/admin/clientes', label: 'Clientes', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/promociones', label: 'Promociones', icon: Receipt, roles: ['ADMIN'] },
  { href: '/admin/finanzas', label: 'Finanzas', icon: Wallet, roles: ['ADMIN', 'CAJERO'] },
  { href: '/admin/cierre-diario', label: 'Cierre Diario', icon: Receipt, roles: ['ADMIN', 'CAJERO'] },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ScrollText, roles: ['ADMIN'] },
  { href: '/admin/respaldos', label: 'Respaldos', icon: Database, roles: ['ADMIN'] },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings, roles: ['ADMIN'] },
  // Operativas
  { href: '/mesero', label: 'Mesero', icon: Utensils, roles: ['ADMIN', 'MESERO'] },
  { href: '/cocina', label: 'Cocina', icon: ChefHat, roles: ['ADMIN', 'COCINA'] },
  { href: '/pizzeria', label: 'Pizzería', icon: Pizza, roles: ['ADMIN', 'PIZZERIA', 'COCINA'] },
  { href: '/ayuda', label: 'Ayuda', icon: HelpCircle, roles: ['ADMIN', 'MESERO', 'COCINA', 'PIZZERIA', 'CAJERO'] },
]

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
  const items = getNavForRole(user?.role)

  return (
    <nav className="flex flex-col gap-1 p-3 overflow-y-auto">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Cambiar tema"
      suppressHydrationWarning
      className="relative"
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
            <AvatarFallback className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 text-xs font-semibold">
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
      .then((d) => d.ok && d.config?.name && setRestaurantName(d.config.name))
      .catch(() => {})
  }, [])

  // Si no hay usuario y no está cargando, no mostramos panel (la ruta lo redirige)
  if (!loading && !user) return null

  return (
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
                <Button variant="ghost" size="icon" className="md:hidden">
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
                const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
                return pathname === i.href || (i.href !== '/' && pathname.startsWith(i.href))
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
            {' · v0.2.0 · Sistema local para restaurante · '}
            <span className="text-slate-400">Sin dependencia de Internet</span>
          </p>
        </footer>
      </div>
    </div>
  )
}
