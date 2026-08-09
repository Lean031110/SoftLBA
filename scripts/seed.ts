// ============================================================
// Seed inicial - Sistema de Restaurante Cuba
// Crea: usuario admin, configuración base, áreas, métodos,
// noticias, productos de ejemplo, artículos de ayuda
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // 1. Configuración del restaurante
  console.log('  → Configuración del restaurante')
  await prisma.restaurantConfig.upsert({
    where: { id: 'config-1' },
    update: {},
    create: {
      id: 'config-1',
      name: 'El Sabor Cubano',
      legalName: 'Restaurante El Sabor Cubano',
      address: 'Calle 23 entre G y H, La Habana, Cuba',
      phone: '+53 7 123 4567',
      email: 'info@elsaborcubano.cu',
      slogan: 'Auténtica cocina cubana, hecha con amor',
      welcomeText: 'Bienvenido a El Sabor Cubano, donde cada plato cuenta una historia.',
      currency: 'CUP',
      currencySymbol: '$',
      hours: 'Lunes a Domingo: 11:00 AM - 11:00 PM',
      taxRate: 0,
      receiptHeader: 'El Sabor Cubano',
      receiptFooter: '¡Gracias por su visita!',
    },
  })

  // 2. Áreas
  console.log('  → Áreas')
  const areas = [
    { code: 'SALON', name: 'Salón', description: 'Área principal de comedor' },
    { code: 'COCINA', name: 'Cocina', description: 'Cocina central' },
    { code: 'PIZZERIA', name: 'Pizzería', description: 'Área de pizzas' },
    { code: 'PRODUCCION', name: 'Producción', description: 'Área de producción general' },
  ]
  for (const area of areas) {
    await prisma.area.upsert({
      where: { code: area.code },
      update: {},
      create: area,
    })
  }

  // 3. Usuario admin
  console.log('  → Usuario administrador')
  const adminPass = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@elsaborcubano.cu',
      passwordHash: adminPass,
      role: 'ADMIN',
      mustChangePass: false,
      firstName: 'Administrador',
      lastName: 'Sistema',
      isActive: true,
    },
  })

  // 4. Usuario mesero demo
  console.log('  → Usuario mesero demo')
  const meseroPass = await bcrypt.hash('mesero123', 10)
  await prisma.user.upsert({
    where: { username: 'mesero' },
    update: {},
    create: {
      username: 'mesero',
      passwordHash: meseroPass,
      role: 'MESERO',
      mustChangePass: false,
      firstName: 'Juan',
      lastName: 'Pérez',
      isActive: true,
    },
  })

  // 5. Usuario cocina demo
  console.log('  → Usuario cocina demo')
  const cocinaPass = await bcrypt.hash('cocina123', 10)
  await prisma.user.upsert({
    where: { username: 'cocina' },
    update: {},
    create: {
      username: 'cocina',
      passwordHash: cocinaPass,
      role: 'COCINA',
      mustChangePass: false,
      firstName: 'María',
      lastName: 'Gómez',
      isActive: true,
    },
  })

  // 6. Usuario cajero demo
  console.log('  → Usuario cajero demo')
  const cajeroPass = await bcrypt.hash('cajero123', 10)
  await prisma.user.upsert({
    where: { username: 'cajero' },
    update: {},
    create: {
      username: 'cajero',
      passwordHash: cajeroPass,
      role: 'CAJERO',
      mustChangePass: false,
      firstName: 'Carlos',
      lastName: 'Rodríguez',
      isActive: true,
    },
  })

  // 6b. Usuario mesero-pro demo (puede hacer cierres pero no finanzas)
  console.log('  → Usuario mesero-pro demo')
  const meseroProPass = await bcrypt.hash('meseropro123', 10)
  await prisma.user.upsert({
    where: { username: 'meseropro' },
    update: {},
    create: {
      username: 'meseropro',
      passwordHash: meseroProPass,
      role: 'MESERO_PRO',
      mustChangePass: false,
      firstName: 'Ana',
      lastName: 'Martínez',
      isActive: true,
    },
  })

  // 7. Noticias
  console.log('  → Noticias iniciales')
  const newsData = [
    {
      title: '¡Bienvenidos!',
      content: 'Hoy abrimos con un nuevo menú. Pregunta por nuestras promociones especiales.',
      type: 'INFO' as const,
      isPublic: true,
      priority: 10,
    },
    {
      title: 'Promo del día',
      content: 'Pizza grande + bebida por $350 CUP. Solo hoy.',
      type: 'PROMO' as const,
      isPublic: true,
      priority: 5,
    },
    {
      title: 'Aviso interno',
      content: 'Reunión de personal a las 4:00 PM en el área de cocina.',
      type: 'WARNING' as const,
      isPublic: false,
      priority: 3,
    },
    {
      title: 'Cambio de menú',
      content: 'A partir del lunes estrenamos nuevos platos en nuestra carta. ¡No te lo pierdas!',
      type: 'INFO' as const,
      isPublic: true,
      priority: 7,
    },
    {
      title: 'Producto agotado',
      content: 'Temporalmente sin stock de Cerveza Nacional. Disculpe las molestias.',
      type: 'URGENT' as const,
      isPublic: true,
      priority: 8,
    },
    {
      title: 'Cambio de turno',
      content: 'Recordar a los meseros entregar el corte de caja antes de salir de turno.',
      type: 'WARNING' as const,
      isPublic: false,
      priority: 4,
    },
    {
      title: 'Cambio de precio',
      content: 'Ajuste de precios en bebidas alcohólicas. Nuevo precio desde mañana.',
      type: 'INFO' as const,
      isPublic: true,
      priority: 6,
    },
  ]
  for (const n of newsData) {
    const existing = await prisma.news.findFirst({ where: { title: n.title } })
    if (!existing) {
      await prisma.news.create({ data: n })
    }
  }

  // 8. Mesas
  console.log('  → Mesas')
  const salonArea = await prisma.area.findUnique({ where: { code: 'SALON' } })
  for (let i = 1; i <= 10; i++) {
    await prisma.table.upsert({
      where: { code: `M${i.toString().padStart(2, '0')}` },
      update: {},
      create: {
        code: `M${i.toString().padStart(2, '0')}`,
        name: `Mesa ${i}`,
        areaId: salonArea!.id,
        capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
      },
    })
  }

  // 9. Productos de ejemplo
  console.log('  → Productos de ejemplo')
  const salonAreaForProducts = await prisma.area.findUnique({ where: { code: 'SALON' } })
  const pizzeriaAreaForProducts = await prisma.area.findUnique({ where: { code: 'PIZZERIA' } })

  const products = [
    // Directos - Bebidas y cafetería (SALON/cocina)
    { code: 'REF-COL', name: 'Refresco Col 350ml', type: 'DIRECTO', unit: 'unidad', cost: 50, price: 80, category: 'Bebidas', areaId: salonAreaForProducts?.id },
    { code: 'REF-NAR', name: 'Refresco Naranja 350ml', type: 'DIRECTO', unit: 'unidad', cost: 50, price: 80, category: 'Bebidas', areaId: salonAreaForProducts?.id },
    { code: 'AGUA-500', name: 'Agua Mineral 500ml', type: 'DIRECTO', unit: 'unidad', cost: 30, price: 60, category: 'Bebidas', areaId: salonAreaForProducts?.id },
    { code: 'CERV-NAC', name: 'Cerveza Nacional 330ml', type: 'DIRECTO', unit: 'unidad', cost: 80, price: 150, category: 'Bebidas', areaId: salonAreaForProducts?.id },
    { code: 'CAFE-EXP', name: 'Café Espresso', type: 'DIRECTO', unit: 'unidad', cost: 15, price: 50, category: 'Cafetería', areaId: salonAreaForProducts?.id },
    // Subproductos - Insumos (sin área específica, son para todas las áreas)
    { code: 'MASA-PIZ', name: 'Masa de Pizza', type: 'SUBPRODUCTO', unit: 'unidad', cost: 60, price: 0, category: 'Insumos', areaId: pizzeriaAreaForProducts?.id },
    { code: 'SALSA-TOM', name: 'Salsa de Tomate', type: 'SUBPRODUCTO', unit: 'ml', cost: 2, price: 0, category: 'Insumos', areaId: pizzeriaAreaForProducts?.id },
    { code: 'CARNE-HAM', name: 'Carne de Hamburguesa', type: 'SUBPRODUCTO', unit: 'unidad', cost: 80, price: 0, category: 'Insumos', areaId: salonAreaForProducts?.id },
    // Finales - Pizzas (PIZZERIA)
    { code: 'PIZ-MAR', name: 'Pizza Margarita', type: 'FINAL', unit: 'unidad', cost: 120, price: 280, category: 'Pizzas', areaId: pizzeriaAreaForProducts?.id },
    { code: 'PIZ-ESP', name: 'Pizza Especial', type: 'FINAL', unit: 'unidad', cost: 180, price: 380, category: 'Pizzas', areaId: pizzeriaAreaForProducts?.id },
    // Finales - Hamburguesas y platos (SALON/cocina)
    { code: 'HAM-CLS', name: 'Hamburguesa Clásica', type: 'FINAL', unit: 'unidad', cost: 110, price: 250, category: 'Hamburguesas', areaId: salonAreaForProducts?.id },
    { code: 'SAN-POLO', name: 'Sándwich de Pollo', type: 'FINAL', unit: 'unidad', cost: 90, price: 200, category: 'Sándwich', areaId: salonAreaForProducts?.id },
    { code: 'ENS-MIX', name: 'Ensalada Mixta', type: 'FINAL', unit: 'unidad', cost: 60, price: 150, category: 'Ensaladas', areaId: salonAreaForProducts?.id },
    { code: 'ARROZ-IMP', name: 'Arroz Imperial', type: 'FINAL', unit: 'porción', cost: 80, price: 180, category: 'Platos', areaId: salonAreaForProducts?.id },
    { code: 'ROPA-VIE', name: 'Ropa Vieja', type: 'FINAL', unit: 'porción', cost: 130, price: 280, category: 'Platos', areaId: salonAreaForProducts?.id },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: { areaId: p.areaId },
      create: p,
    })
  }

  // 10. Inventario inicial
  console.log('  → Inventario inicial')
  const directProducts = await prisma.product.findMany({ where: { type: 'DIRECTO' } })
  for (const p of directProducts) {
    await prisma.inventoryItem.upsert({
      where: { productId: p.id },
      update: {},
      create: {
        productId: p.id,
        stock: 50,
        reserved: 0,
      },
    })
  }

  // 11. Inventario por área
  console.log('  → Inventario por área')
  const cocinaArea = await prisma.area.findUnique({ where: { code: 'COCINA' } })
  const pizzeriaArea = await prisma.area.findUnique({ where: { code: 'PIZZERIA' } })

  // Cocina: subproductos
  const subproducts = await prisma.product.findMany({ where: { type: 'SUBPRODUCTO' } })
  for (const sp of subproducts) {
    await prisma.areaInventory.upsert({
      where: { areaId_productId: { areaId: cocinaArea!.id, productId: sp.id } },
      update: {},
      create: {
        areaId: cocinaArea!.id,
        productId: sp.id,
        stock: 20,
        minStock: 5,
      },
    })
  }

  // Pizzería: masa de pizza
  const masaPizza = await prisma.product.findUnique({ where: { code: 'MASA-PIZ' } })
  if (masaPizza) {
    await prisma.areaInventory.upsert({
      where: { areaId_productId: { areaId: pizzeriaArea!.id, productId: masaPizza.id } },
      update: {},
      create: {
        areaId: pizzeriaArea!.id,
        productId: masaPizza.id,
        stock: 15,
        minStock: 5,
      },
    })
  }

  // 12. Artículos de ayuda
  console.log('  → Artículos de ayuda')
  const helpArticles = [
    { module: 'pedidos', title: 'Cómo tomar un pedido', content: 'Para tomar un pedido:\n1. Selecciona el área (Salón, Pizzería, etc.)\n2. Elige la mesa o marca como para llevar\n3. Agrega productos buscándolos por nombre o código\n4. Indica la cantidad\n5. Si necesitas, agrega notas (ej: sin cebolla)\n6. Revisa el total\n7. Envía el pedido a cocina\n\nEl pedido aparecerá automáticamente en la pantalla de cocina correspondiente.', order: 1 },
    { module: 'pedidos', title: 'Cómo cobrar un pedido', content: 'Para cobrar:\n1. Abre el pedido desde "Mis Pedidos"\n2. Toca "Cobrar"\n3. Selecciona el método de pago (efectivo, transferencia, etc.)\n4. Si es pago combinado, agrega cada parte\n5. Indica el monto recibido\n6. Confirma el cobro\n7. Genera el comprobante si es necesario', order: 2 },
    { module: 'cierre', title: 'Cómo cerrar caja', content: 'Para el cierre diario:\n1. Ve a Cierre Diario en el panel de administración\n2. Verifica que todos los pedidos estén cobrados\n3. Cuenta el efectivo por denominación\n4. Registra cada denominación\n5. Compara con el total teórico\n6. Si hay diferencia, registra observación\n7. Confirma el cierre\n\nUna vez cerrado, el período queda bloqueado.', order: 1 },
    { module: 'inventario', title: 'Cómo cargar inventario', content: 'Para cargar stock físico:\n1. Ve a tu área (Cocina, Pizzería, etc.)\n2. Entra a "Mi Inventario"\n3. Para cada producto, ingresa la cantidad física contada\n4. Agrega observación si hay diferencia\n5. Guarda\n\nEl sistema comparará automáticamente con el stock teórico y registrará la diferencia.', order: 1 },
    { module: 'productos', title: 'Cómo crear productos', content: 'Para crear un producto:\n1. Ve a Administración > Productos\n2. Toca "Nuevo Producto"\n3. Completa código, nombre, tipo (Directo, Final, Subproducto)\n4. Indica unidad (unidad, ml, kg, etc.)\n5. Pone costo y precio\n6. Si es Final, puedes asignar receta\n7. Guarda\n\nLos productos inactivos no aparecen en el panel del mesero.', order: 1 },
    { module: 'productos', title: 'Cómo crear recetas', content: 'Para crear una receta:\n1. Ve a Administración > Productos > Recetas\n2. Selecciona el producto final\n3. Agrega ingredientes (productos directos o subproductos)\n4. Indica cantidad y unidad de cada uno\n5. El sistema calculará el costo total\n6. Guarda', order: 2 },
    { module: 'sistema', title: 'Cómo recuperar acceso', content: 'Si olvidaste tu contraseña:\n1. Pide al administrador que resetee tu contraseña\n2. El admin va a Administración > Usuarios\n3. Selecciona tu usuario\n4. Genera nueva contraseña\n5. En el próximo login, deberás cambiarla\n\nNunca compartas tu contraseña con nadie.', order: 1 },
    { module: 'sistema', title: 'Qué hacer ante errores', content: 'Si el sistema falla:\n1. No cierres la ventana\n2. Toma nota del error o captura de pantalla\n3. Recarga la página (F5)\n4. Si persiste, cierra sesión y vuelve a entrar\n5. Si no funciona, contacta al administrador\n6. El admin puede restaurar desde respaldo si es necesario\n\nEl sistema guarda todo, así que no se perderán datos.', order: 2 },
  ]
  for (const h of helpArticles) {
    await prisma.helpArticle.create({ data: h }).catch(() => {})
  }

  // 13. Promoción inicial
  console.log('  → Promoción inicial')
  await prisma.promotion.create({
    data: {
      name: 'Pizza + Bebida',
      description: 'Pizza Margarita + Refresco por $350 CUP',
      type: 'GENERAL',
      discountAmount: 10,
      startDate: new Date(),
      isActive: true,
    },
  }).catch(() => {})

  // 14. Audit log inicial
  console.log('  → Audit log inicial')
  const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } })
  await prisma.auditLog.create({
    data: {
      userId: adminUser!.id,
      action: 'SEED',
      entity: 'system',
      entityId: 'init',
      after: 'Base de datos inicializada con datos de prueba',
      result: 'SUCCESS',
    },
  })

  console.log('✅ Seed completado exitosamente')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('USUARIOS CREADOS:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👤 Admin       : admin / admin123')
  console.log('👤 Mesero      : mesero / mesero123')
  console.log('👤 Mesero Pro  : meseropro / meseropro123')
  console.log('👤 Cocina      : cocina / cocina123')
  console.log('👤 Cajero      : cajero / cajero123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
