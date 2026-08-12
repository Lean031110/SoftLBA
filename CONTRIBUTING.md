# Contribuir a SoftLBA

¡Gracias por tu interés en contribuir a SoftLBA! Este es un proyecto cubano de código abierto desarrollado en colaboración con Inteligencia Artificial.

## 📋 Antes de contribuir

1. **Lee el README.md** para entender la arquitectura del proyecto.
2. **Revisa los issues abiertos** para ver qué hay que hacer.
3. **Abre un issue** antes de empezar a trabajar en una funcionalidad grande, para discutir el enfoque.

## 🚀 Cómo contribuir

### 1. Fork y clone

```bash
git clone https://github.com/TU_USUARIO/SoftLBA.git
cd SoftLBA
git remote add upstream https://github.com/Lean031110/SoftLBA.git
```

### 2. Instalar dependencias

```bash
bun install
```

### 3. Configurar entorno

```bash
cp .env.example .env
# Edita .env con tus valores
```

### 4. Crear rama para tu feature

```bash
git checkout -b feature/mi-nueva-funcionalidad
```

### 5. Hacer cambios

- Sigue el estilo de código existente.
- Escribe tests para nuevas funcionalidades.
- Asegúrate de que `npx tsc --noEmit` no dé errores.
- Ejecuta `npx vitest run` y verifica que todos los tests pasen.

### 6. Commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: añadir búsqueda de productos por código de barras"
git commit -m "fix: corregir cálculo de cambio en pago combinado"
git commit -m "docs: actualizar documentación de API"
```

### 7. Push y Pull Request

```bash
git push origin feature/mi-nueva-funcionalidad
```

Abre un Pull Request en GitHub describiendo los cambios.

## 🏗️ Arquitectura del proyecto

```
SoftLBA/
├── src/
│   ├── app/              # Páginas y API routes de Next.js
│   │   ├── api/          # Endpoints REST
│   │   ├── admin/        # Panel de administración
│   │   ├── mesero/       # Interfaz del mesero (POS)
│   │   ├── cocina/       # Pantalla de cocina
│   │   └── pizzeria/     # Pantalla de pizzería
│   ├── lib/              # Servicios y utilidades
│   │   ├── auth/         # Autenticación y tokens
│   │   ├── inventory/    # InventoryService (fuente única de stock)
│   │   ├── money/        # MoneyService (manejo de dinero)
│   │   ├── tables/       # TableService (mesas atómicas)
│   │   ├── products/     # ProductAreaResolver
│   │   ├── security/     # Rate limiter, URL validator
│   │   └── permissions/  # Sistema de permisos
│   ├── components/        # Componentes React
│   └── hooks/            # Hooks de React
├── prisma/               # Schema y migraciones de Prisma
├── mini-services/         # Servicio Socket.IO (realtime)
├── scripts/              # Scripts de mantenimiento
├── tests/                # Tests unitarios e integración
└── public/               # Assets estáticos
```

## 📐 Reglas de código

### TypeScript
- **0 errores** de `npx tsc --noEmit`.
- No uses `any` sin justificación.
- No uses `@ts-ignore`.

### Estilo
- Indentación: 2 espacios.
- Comillas simples para strings.
- Punto y coma al final de línea.

### Commits
- Usa Conventional Commits.
- Un commit = un cambio lógico.
- Mensaje en español o inglés, pero consistente.

### Tests
- Todo nuevo servicio debe tener tests unitarios.
- Las correcciones de bugs deben incluir tests de regresión.

## 🇨🇺 Contexto del proyecto

SoftLBA es un sistema POS/ERP diseñado para restaurantes en Cuba, con soporte para:
- Operación en LAN sin Internet.
- Múltiples monedas (CUP/USD).
- PWA instalable en móviles.
- Múltiples áreas de producción (cocina, pizzería, bar, etc.).

## 🤖 Sobre la colaboración con IA

Este proyecto ha sido desarrollado en gran parte mediante colaboración con IA (Super Z / GLM por Z.ai). Las decisiones de arquitectura, código y correcciones han sido guiadas por un humano (Leandro) que revisa, aprueba y dirige el trabajo.

Si contribuyes con código generado por IA, indícalo en el Pull Request.

## 📞 Contacto

- **Repositorio:** [https://github.com/Lean031110/SoftLBA](https://github.com/Lean031110/SoftLBA)
- **Issues:** [https://github.com/Lean031110/SoftLBA/issues](https://github.com/Lean031110/SoftLBA/issues)

---

¡Gracias por contribuir al software libre cubano! 🇨🇺
