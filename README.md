<div align="center">

# 🍽️ SoftLBA

### Sistema POS/ERP para Restaurantes — Hecho en Cuba 🇨🇺

[![Version](https://img.shields.io/badge/versión-1.0.18-blue.svg)](https://github.com/Lean031110/SoftLBA/releases)
[![License: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-0%20errores-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-157%20pasando-brightgreen.svg)](https://github.com/Lean031110/SoftLBA/actions)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-indigo.svg)](https://www.prisma.io/)

</div>

---

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Arquitectura](#-arquitectura)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [API](#-api)
- [Tests](#-tests)
- [Contribuir](#-contribuir)
- [Créditos](#-créditos)
- [Licencia](#-licencia)

---

## 📖 Descripción

**SoftLBA** es un sistema POS (Point of Sale) y ERP diseñado específicamente para restaurantes en Cuba. Permite gestionar pedidos, inventario, mesas, pagos, finanzas, cocina y pizzería desde una sola plataforma.

El sistema está optimizado para funcionar en redes locales (LAN) sin acceso a Internet, con soporte PWA para instalación en dispositivos móviles, y manejo de múltiples monedas (CUP/USD).

### 🇨🇺 Contexto Cubano

Este proyecto nace de la necesidad de un sistema POS moderno, accesible y funcional para el entorno cubano:
- Funciona sin Internet (LAN local).
- Soporta moneda nacional (CUP) y divisas (USD).
- Diseñado para conexión WiFi local del restaurante.
- Instalable como app en teléfonos Android/iOS (PWA).

---

## ✨ Características

### 🧾 Pedidos Multiárea
- Un pedido puede contener productos de múltiples áreas (cocina, pizzería, salón).
- Cada área solo ve y gestiona sus propios items.
- Productos directos (bebidas, empanadas) se despachan sin pasar por producción.

### 📊 Inventario Unificado
- `InventoryService` como única fuente de verdad.
- Transferencias atómicas entre áreas (CENTRAL → SALÓN).
- Validación de stock con bloqueo de negativos.
- Auditoría de duplicaciones.

### 💰 Finanzas
- Soporte multi-moneda (CUP/USD) con tasa de cambio configurable.
- Snapshot histórico de tasa (`exchangeRate`, `convertedAmount`).
- Cierre diario con denominaciones.
- Anulación financiera con compensación.

### 🍳 Producción
- Pantallas separadas para cocina y pizzería.
- `targetAreaId` estricto: cada área solo modifica sus items.
- Consumo automático de recetas al marcar LISTO.
- Estado DESPACHADO para productos directos.

### 🏪 Mesas
- `TableService` con operaciones atómicas (evita doble asignación).
- `currentOrderId` para ownership de mesa.
- Transferencia de mesa atómica.

### 🔐 Seguridad
- Tokens HMAC con `authVersion` (invalidación inmediata al cambiar rol/contraseña).
- Rate limiting por IP + dispositivo en login.
- Validación de URLs (previene XSS stored).
- Endpoint interno con shared secret.

### ⚡ Tiempo Real
- Socket.IO con autenticación por token.
- Server emite eventos después del DB COMMIT.
- Frontend solo recibe, no emite eventos de negocio.
- Salas por rol y área (derivadas del servidor, no del cliente).

### 🔁 Idempotencia
- `idempotencyKey` en pagos para prevenir doble cobro.
- Compatible con reintentos de red y service worker.

### 📱 PWA
- Instalable como app nativa.
- Funcionamiento offline (UI cache).
- Service worker configurado.

---

## 🛠️ Tecnologías

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| **Next.js** | 16 | Framework full-stack (App Router, Turbopack) |
| **React** | 19 | UI |
| **TypeScript** | 5 | Tipado estático (0 errores) |
| **Prisma** | 6 | ORM (SQLite, migrable a PostgreSQL) |
| **Tailwind CSS** | 4 | Estilos |
| **shadcn/ui** | — | Componentes UI |
| **Socket.IO** | 4 | Tiempo real |
| **Vitest** | 4 | Testing |
| **Zod** | 4 | Validación de schemas |
| **Bun** | 1 | Runtime y package manager |

---

## 🏗️ Arquitectura

```
                    ┌─────────────┐
                    │   Cliente    │
                    │  (Navegador)  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Next.js    │
                    │  (Puerto 3000)│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼─────┐ ┌───▼────┐ ┌────▼─────┐
       │   Prisma    │ │ Socket │ │  Servicios │
       │   (SQLite)  │ │ .IO    │ │ de Dominio │
       └─────────────┘ └────────┘ └───────────┘
```

### Servicios de Dominio

| Servicio | Archivo | Responsabilidad |
|----------|---------|----------------|
| `InventoryService` | `src/lib/inventory/` | Fuente única de stock (consume, return, transfer) |
| `TableService` | `src/lib/tables/` | Mesas atómicas (take, release, transfer) |
| `MoneyService` | `src/lib/money/` | Dinero (redondeo bancario, cambio, conversión) |
| `ProductAreaResolver` | `src/lib/products/` | Resolución de áreas de producto |
| `LoginRateLimiter` | `src/lib/security/` | Rate limiting por IP + dispositivo |
| `URLValidator` | `src/lib/security/` | Validación de URLs (anti-XSS) |

---

## 📥 Instalación

### Requisitos

- **Node.js 18+** o **Bun 1+**
- **SQLite** (incluido en el sistema)

### Pasos

```bash
# 1. Clonar repositorio
git clone https://github.com/Lean031110/SoftLBA.git
cd SoftLBA

# 2. Instalar dependencias
bun install

# 3. Configurar entorno
cp .env.example .env
# Edita .env con tus valores (especialmente NEXTAUTH_SECRET)

# 4. Generar cliente Prisma
bun run db:generate

# 5. Crear base de datos
bun run db:push

# 6. (Opcional) Cargar datos de prueba
bun run db:seed

# 7. Iniciar servidor de desarrollo
bun run dev
```

El servidor estará disponible en `http://localhost:3000`.

### Iniciar con Realtime

```bash
# En una terminal:
bun run dev

# En otra terminal:
bun run realtime
```

O ambos juntos:
```bash
bun run dev:all
```

---

## ⚙️ Configuración

Ver [`.env.example`](.env.example) para todas las variables de entorno.

### Variables críticas

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | URL de la base de datos | `file:./db/custom.db` |
| `NEXTAUTH_SECRET` | Secreto de sesión (MÍN 16 chars) | — |
| `REALTIME_SECRET` | Secreto compartido realtime | — |
| `DEMO_USERS` | Mostrar usuarios demo | `true` (dev), `false` (prod) |
| `COOKIE_SECURE` | Cookie HTTPS | `false` (LAN), `true` (HTTPS) |

---

## 🚀 Uso

### Usuarios de prueba (desarrollo)

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `admin123` | Administrador |
| `mesero` | `mesero123` | Mesero |
| `cocina` | `cocina123` | Cocina |
| `cajero` | `cajero123` | Cajero |
| `pizzeria` | `pizzeria123` | Pizzería |

> ⚠️ **En producción:** Cambia todas las contraseñas y configura `DEMO_USERS=false`.

---

## 📡 API

### Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Iniciar sesión |
| `GET` | `/api/auth/me` | Usuario actual |
| `POST` | `/api/mesero/orders` | Crear pedido |
| `GET` | `/api/mesero/orders` | Listar pedidos |
| `POST` | `/api/mesero/orders/[id]/pay` | Pagar pedido |
| `POST` | `/api/mesero/orders/[id]/cancel` | Cancelar pedido |
| `GET` | `/api/cocina/orders` | Pedidos de cocina |
| `GET` | `/api/pizzeria/orders` | Pedidos de pizzería |
| `GET` | `/api/public/config` | Config pública |

---

## 🧪 Tests

```bash
# Ejecutar todos los tests
npx vitest run

# Con coverage
npx vitest run --coverage

# En modo watch
npx vitest
```

### Cobertura actual

- **157 tests unitarios** — todos pasan
- **0 errores TypeScript** (`npx tsc --noEmit`)

---

## 🤝 Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para la guía completa de contribución.

### Resumen rápido

1. Fork del repositorio
2. Crear rama: `git checkout -b feature/mi-funcionalidad`
3. Commit: `git commit -m "feat: mi funcionalidad"`
4. Push: `git push origin feature/mi-funcionalidad`
5. Abrir Pull Request

---

## 👥 Créditos

### Desarrollador

- **Leandro** ([@Lean031110](https://github.com/Lean031110)) — Desarrollador principal, arquitectura, dirección del proyecto y revisión de código.

### Colaboración con IA

Este proyecto ha sido desarrollado en gran medida mediante colaboración con **Inteligencia Artificial**:

- **[Super Z](https://z.ai)** — Asistente de IA basado en el modelo GLM, desarrollado por [Z.ai](https://z.ai). Ha participado en:
  - Implementación de servicios de dominio (InventoryService, TableService, MoneyService, ProductAreaResolver).
  - Corrección de bugs y regresiones.
  - Auditoría de seguridad y concurrencia.
  - Generación de tests unitarios.
  - Documentación técnica.

> Las decisiones de arquitectura, validación de comportamiento y aprobación final de todos los cambios corresponden al desarrollador humano.

### Agradecimientos

- A la comunidad de software libre cubana.
- A todos los colaboradores que han sugerido mejoras.

---

## 📄 Licencia

Este proyecto está bajo la [Licencia MIT](LICENSE).

---

## 📊 Estado del Proyecto

| Métrica | Valor |
|---------|-------|
| Versión | 1.0.18 |
| Tests | 157 pasando |
| Errores TS | 0 |
| Última actualización | Agosto 2026 |

---

<div align="center">

**Hecho con ❤️ en Cuba 🇨🇺**

[Reportar Bug](https://github.com/Lean031110/SoftLBA/issues) · [Solicitar Feature](https://github.com/Lean031110/SoftLBA/issues) · [Ver Releases](https://github.com/Lean031110/SoftLBA/releases)

</div>
