# Guía de Migración de Base de Datos - SoftLBA

SoftLBA está diseñado para ser 100% migrable entre motores de base de datos.
Actualmente usa **SQLite** (sin dependencia de servidor, ideal para un PC local),
pero está preparado para migrar a **PostgreSQL** o **MySQL/MariaDB** cuando el
restaurante crezca.

## Por qué es migrable

1. **Prisma ORM**: Toda la lógica de base de datos va a través de Prisma Client.
   No hay SQL crudo en el código de aplicación.

2. **Schema único**: El archivo `prisma/schema.prisma` define todos los modelos.
   Solo se cambia `provider` y `url`.

3. **Tipos estándar**: Todos los campos usan tipos estándar de Prisma
   (String, Int, Float, Boolean, DateTime) que se mapean automáticamente a cada motor.

4. **Sin extensiones específicas**: No se usan funciones específicas de SQLite
   como `JSON1` o `PRAGMA` en el código de aplicación.

5. **Migraciones**: Prisma genera migraciones SQL estándar aplicables a cualquier motor.

## Cómo migrar a PostgreSQL

### 1. Instalar PostgreSQL en el servidor

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Crear base de datos y usuario
sudo -u postgres psql
postgres=# CREATE DATABASE softlba;
postgres=# CREATE USER softlba_user WITH PASSWORD 'tu_password_seguro';
postgres=# GRANT ALL PRIVILEGES ON DATABASE softlba TO softlba_user;
postgres=# \q
```

### 2. Cambiar configuración en SoftLBA

Editar `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // <-- cambiar de "sqlite" a "postgresql"
  url      = env("DATABASE_URL")
}
```

Editar `.env`:

```
DATABASE_URL=postgresql://softlba_user:tu_password_seguro@localhost:5432/softlba
```

### 3. Migrar los datos existentes (opcional)

Si tienes datos en SQLite que quieres conservar:

```bash
# Instalar pgloader (migra automáticamente SQLite a PostgreSQL)
sudo apt install pgloader

# Crear archivo de migración
cat > migrate.command << 'EOF'
LOAD DATABASE
  FROM sqlite:///home/z/my-project/db/custom.db
  INTO postgresql://softlba_user:tu_password_seguro@localhost:5431/softlba

WITH include drop, create tables, create indexes, reset sequences, downcase identifiers

SET work_mem to '16MB'

CAST type datetime to timestamptz drop default drop not null using zero-datetime-to-null
;
EOF

# Ejecutar migración
pgloader migrate.command
```

### 4. Aplicar el schema a PostgreSQL

```bash
cd /home/z/my-project
bun run db:push
```

### 5. Verificar

```bash
# Reiniciar servidor
bun run dev

# Verificar que las consultas funcionan
curl http://localhost:3000/api/public/config
curl http://localhost:3000/api/public/products
```

## Cómo migrar a MySQL/MariaDB

### 1. Instalar MySQL/MariaDB

```bash
sudo apt install mariadb-server
sudo systemctl enable mariadb
sudo systemctl start mariadb

sudo mysql -u root
CREATE DATABASE softlba CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'softlba_user'@'localhost' IDENTIFIED BY 'tu_password_seguro';
GRANT ALL PRIVILEGES ON softlba.* TO 'softlba_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Cambiar configuración

Editar `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "mysql"  // <-- cambiar a "mysql"
  url      = env("DATABASE_URL")
}
```

Editar `.env`:

```
DATABASE_URL=mysql://softlba_user:tu_password_seguro@localhost:3306/softlba
```

### 3. Aplicar schema

```bash
bun run db:push
```

## Comparativa

| Aspecto | SQLite | PostgreSQL | MySQL/MariaDB |
|---------|--------|------------|---------------|
| **Setup** | Ninguno (archivo local) | Servidor dedicado | Servidor dedicado |
| **Concurrencia** | Limitada (1 escritor) | Alta (multi-usuario) | Alta (multi-usuario) |
| **Tamaño máx** | ~280 TB teórico, práctico 1-10 GB | Ilimitado | Ilimitado |
| **Red** | No (archivo local) | Sí (TCP) | Sí (TCP) |
| **Backups** | Copiar archivo | `pg_dump` | `mysqldump` |
| **Ideal para** | 1 PC, restaurante pequeño | Multi-sucursal, alto tráfico | Multi-sucursal, alto tráfico |

## Cuándo migrar

- **Mantener SQLite** si: 1 servidor, menos de 50 usuarios concurrentes,
  menos de 1000 pedidos/día, no necesitas acceso remoto.

- **Migrar a PostgreSQL** si: múltiples PCs accediendo al mismo tiempo,
  más de 1000 pedidos/día, necesitas reportería pesada, quieres respaldos automáticos.

- **Migrar a MySQL/MariaDB** si: ya tienes MariaDB instalado en tu infraestructura,
  o prefieres su ecosistema.

## Backup antes de migrar

**SIEMPRE** hacer backup antes de migrar:

```bash
# Backup de SQLite
cp /home/z/my-project/db/custom.db /home/z/my-project/backups/pre-migracion-$(date +%Y%m%d).db

# Backup del proyecto completo
bun run backup pre-migracion
```

## Rollback

Si la migración falla, restaurar:

```bash
# Restaurar SQLite
cp /home/z/my-project/backups/pre-migracion-YYYYMMDD.db /home/z/my-project/db/custom.db

# Restaurar schema.prisma y .env
git checkout prisma/schema.prisma
git checkout .env

# Reiniciar
bun run dev
```
