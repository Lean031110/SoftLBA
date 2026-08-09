# Sistema de Restaurante Cuba

Sistema integral para restaurante en red local, diseñado para operar sin Internet.
Pensado para el trabajo real del día a día en Cuba.

## Características principales

- **Sin Internet obligatorio** - Funciona en red local / intranet
- **Tiempo real** - Pedidos, estados y notificaciones vía WebSocket
- **Multi-rol** - Administrador, mesero, cocina, pizzería, cajero
- **Multi-dispositivo** - Teléfonos, tablets, monitores, pantallas de cocina
- **Trazabilidad total** - Cada movimiento queda auditado
- **Base migrable** - SQLite ahora, PostgreSQL/MySQL en el futuro
- **Interfaz moderna** - Minimalista, rápida, responsive, con tema claro/oscuro

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript |
| Frontend | Next.js 16 (App Router) + React 19 |
| Backend | Next.js API Routes + Mini servicios |
| Tiempo real | Socket.IO |
| ORM | Prisma 6 |
| Base de datos | SQLite (migrable a PostgreSQL/MySQL) |
| Estilos | Tailwind CSS 4 |
| Componentes | shadcn/ui (New York) |
| Iconos | Lucide React |
| Animaciones | Framer Motion |
| Autenticación | NextAuth.js v4 |
| Estado | Zustand + TanStack Query |
| Formularios | React Hook Form + Zod |

## Requisitos

- Node.js 18+ o Bun
- Navegador moderno (Chrome, Firefox, Safari, Edge)

## Instalación

```bash
# Instalar dependencias
bun install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con DATABASE_URL y NEXTAUTH_SECRET

# Inicializar base de datos
bun run db:push

# Cargar datos iniciales (seed)
bun run db:seed

# Iniciar servidor de desarrollo
bun run dev
```

Abrir `http://localhost:3000` en el navegador.

## Usuario administrador por defecto

- **Usuario:** `admin`
- **Contraseña:** `admin123`

> ⚠️ Cambiar la contraseña después del primer inicio de sesión.

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/          # Páginas de autenticación (login, logout)
│   ├── admin/           # Panel de administración
│   ├── mesero/          # Área de meseros
│   ├── cocina/          # Área de cocina
│   ├── pizzeria/        # Área de pizzería
│   ├── api/             # API routes
│   ├── layout.tsx       # Layout raíz
│   └── page.tsx         # Home pública
├── components/
│   ├── ui/              # Componentes shadcn/ui
│   ├── layout/          # Layout compartido (sidebar, header, footer)
│   └── shared/          # Componentes compartidos
├── lib/
│   ├── auth/            # Configuración de autenticación
│   ├── permissions/     # Helpers de permisos
│   ├── validators/      # Esquemas Zod
│   ├── db.ts            # Cliente Prisma
│   └── utils.ts         # Utilidades
├── hooks/               # Hooks personalizados
└── types/               # Tipos TypeScript

mini-services/
└── realtime-service/    # Servicio WebSocket Socket.IO

prisma/
├── schema.prisma        # Esquema de base de datos
└── seeds/               # Scripts de datos iniciales

docs/                    # Documentación adicional
backups/                 # Copias de respaldo
scripts/                 # Scripts de utilidad
```

## Roles y permisos

| Rol | Acceso |
|-----|--------|
| ADMIN | Acceso total al sistema |
| MESERO | Solo sus pedidos, crear pedidos, cobrar según permisos |
| COCINA | Ver pedidos en tiempo real, cambiar estados |
| PIZZERIA | Similar a cocina, con inventario propio |
| CAJERO | Cobros y cierre diario |

## Documentación

- [CHANGELOG.md](./CHANGELOG.md) - Historial de versiones
- [docs/arquitectura.md](./docs/arquitectura.md) - Documentación técnica
- [docs/flujo-pedidos.md](./docs/flujo-pedidos.md) - Flujo de pedidos
- [docs/permisos.md](./docs/permisos.md) - Matriz de permisos

## Licencia

Uso interno - Restaurante Cuba
