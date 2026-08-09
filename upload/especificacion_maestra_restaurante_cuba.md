# ESPECIFICACIÓN MAESTRA DEL PROYECTO
## Sistema local para restaurante en Cuba

**Versión:** 1.0  
**Base inicial:** SQLite  
**Migrable a:** PostgreSQL / MySQL / MariaDB  
**Modo de operación:** Red local / intranet, sin dependencia de Internet

---

## 1. Visión general

Este proyecto será un sistema profesional para restaurante que funcione dentro de una red local en Cuba. Debe operar sin Internet y permitir trabajo simultáneo desde teléfonos, tablets y computadoras conectadas al servidor local.

La idea no es construir un POS simple, sino un sistema integral con:

- toma de pedidos,
- cocina en tiempo real,
- inventario general y por áreas,
- finanzas,
- cierre diario,
- clientes y promociones,
- noticias internas,
- perfiles avanzados de usuarios,
- ayuda integrada,
- auditoría,
- respaldos,
- estructura preparada para crecer.

El sistema debe sentirse ágil, claro y seguro. Nada de pantallas pesadas ni flujos enredados. La operación debe ser rápida para que el personal trabaje cómodo, sin perder tiempo.

---

## 2. Objetivo principal

Permitir que el restaurante funcione digitalmente en red local, con control total desde administración, pedidos en tiempo real, inventarios separados por área, finanzas trazables y reportes completos.

---

## 3. Principios fundamentales

1. **Sin Internet obligatorio.**
2. **Todo usuario autenticado.**
3. **Cada rol ve solo lo suyo.**
4. **Cada movimiento queda registrado.**
5. **No borrar historia, solo corregir con trazabilidad.**
6. **Interfaz rápida, clara y moderna.**
7. **Móvil y tablet primero.**
8. **Base de datos preparada para migrar.**
9. **El sistema debe escalar sin romperse.**
10. **La ayuda debe estar integrada.**

---

## 4. Tecnología recomendada

### 4.1 Lenguaje
**TypeScript**

### 4.2 Stack sugerido
- **Frontend:** React o Next.js
- **Backend:** NestJS
- **Tiempo real:** WebSockets / Socket.IO
- **ORM:** Prisma
- **Base de datos inicial:** SQLite
- **Base de datos futura:** PostgreSQL o MySQL/MariaDB
- **Estilos:** Tailwind CSS
- **Componentes modernos:** shadcn/ui o equivalente
- **Animaciones suaves:** Framer Motion

### 4.3 Por qué TypeScript
Porque permite hacer frontend y backend con el mismo lenguaje, reduce errores, facilita el mantenimiento y encaja muy bien con sistemas grandes que necesitan orden y crecimiento futuro.

### 4.4 Por qué NestJS
Porque organiza el código por módulos, servicios y controladores, lo que ayuda a que el proyecto no se convierta en un monstruo de espagueti digital.

---

## 5. Entorno de uso

El sistema debe funcionar en:
- servidor local o PC principal,
- red Wi-Fi interna,
- tablets,
- teléfonos,
- computadoras con navegador,
- dispositivos de cocina y administración.

No debe depender de servicios externos para seguir trabajando.

---

## 6. Estructura general del sistema

### 6.1 Página principal pública `/`
Debe ser una página tipo home con:
- logo,
- nombre del restaurante,
- información básica,
- noticias del día,
- avisos de cambios,
- productos disponibles o no disponibles,
- botón de login.

### 6.2 Login
- autenticación por usuario y contraseña,
- redirección automática según rol,
- primer acceso con perfil obligatorio,
- sin acceso a áreas incorrectas.

### 6.3 Panel de administración
Acceso total a:
- usuarios,
- productos,
- recetas,
- inventarios,
- finanzas,
- reportes,
- cierre diario,
- noticias,
- clientes,
- configuración,
- auditoría.

### 6.4 Área de meseros
- solo ve su sesión,
- solo ve sus pedidos,
- puede crear pedidos,
- puede cobrar según permisos,
- recibe notificaciones en tiempo real.

### 6.5 Área de cocina
- recibe pedidos al instante,
- ve tarjetas expandibles,
- marca estados,
- ve solo lo autorizado.

### 6.6 Área de pizzería / producción
- funciona similar a cocina,
- con su propio inventario y flujo.

### 6.7 Inventario por áreas
- salón,
- cocina,
- pizzería,
- producción,
- otras áreas futuras.

### 6.8 Finanzas
- ventas,
- gastos,
- salarios,
- compras,
- mermas,
- cierre,
- libro mayor resumido.

---

## 7. Módulo de usuarios

### 7.1 Creación
Solo el administrador crea usuarios.

Debe introducir:
- nombre,
- apellidos,
- rol.

El sistema genera automáticamente:
- nombre de usuario único,
- contraseña aleatoria inicial.

### 7.2 Primer inicio de sesión
El usuario debe completar:
- nombre y apellido rectificados,
- teléfono fijo opcional,
- móvil opcional,
- correo opcional,
- dirección particular,
- número de identificación o carnet,
- biografía / experiencia laboral,
- cambio obligatorio de contraseña.

### 7.3 Perfil
Toda la información queda guardada y el administrador puede verla en cualquier momento.

### 7.4 Reglas
- nombre de usuario único,
- historial de acceso,
- estado activo/inactivo,
- rol fijo o editable según permisos,
- foto opcional en el futuro.

---

## 8. Página principal con noticias

La home debe mostrar noticias y avisos configurables desde administración, por ejemplo:
- cambio de menú,
- cambio de precio,
- producto agotado,
- área cerrada,
- promoción del día,
- aviso interno,
- cambios de turno,
- recordatorios operativos.

La administración debe poder decidir qué se ve públicamente y qué solo se ve tras autenticación.

---

## 9. Información del restaurante

Debe existir una sección de configuración general con:
- nombre comercial,
- logo,
- dirección,
- teléfono,
- correo,
- redes sociales,
- horario,
- eslogan,
- moneda,
- texto de bienvenida,
- datos para comprobantes.

Estos datos deben reutilizarse en:
- home,
- login,
- comprobantes,
- encabezados,
- reportes,
- documentos exportados.

---

## 10. Productos y recetas

### 10.1 Tipos de productos

#### a) Productos de venta directa
Ejemplos:
- enlatados,
- bebidas,
- refrescos,
- artículos listos para entregar.

#### b) Productos elaborados finales
Ejemplos:
- pizza,
- hamburguesa,
- sándwich,
- platos terminados.

#### c) Subproductos / preelaborados
Ejemplos:
- masa de pizza,
- salsa,
- carne preparada,
- masa de hamburguesa.

### 10.2 Relación entre productos
Un producto final puede depender de subproductos.  
El sistema debe permitir registrar esa cadena de elaboración.

### 10.3 Recetas
Cada receta puede incluir:
- ingredientes,
- cantidades,
- unidades,
- costo estimado,
- rendimiento,
- producto final asociado,
- subproductos necesarios.

### 10.4 Productos activos e inactivos
El panel del mesero debe mostrar solo productos finales activos y disponibles.

---

## 11. Inventario general y por áreas

### 11.1 Inventario general
Administrado por el administrador.

Permite:
- entradas por compra,
- salidas por merma,
- traslados a áreas,
- ajustes,
- correcciones autorizadas.

### 11.2 Inventario por áreas
Cada área tiene su inventario independiente.

### 11.3 Reglas importantes
- Los usuarios de cada área pueden introducir su stock físico.
- Los productos con stock 0 deben seguir visibles.
- No se borra historial al corregir.
- Toda diferencia debe quedar registrada.
- Las áreas solo ven su propio inventario.

### 11.4 Stock físico
Cada área puede cargar:
- producto,
- cantidad física,
- observación,
- fecha,
- usuario responsable.

### 11.5 Comparación final
Debe existir comparación entre:
- stock teórico,
- stock físico.

---

## 12. Flujo de pedidos

### 12.1 Toma del pedido
Cada mesero trabaja desde su propia sesión.

### 12.2 Restricciones
- no ver pedidos de otros meseros,
- no crear pedidos a nombre de otro,
- no editar pedidos ajenos salvo permisos especiales,
- historial personal limitado.

### 12.3 Datos del pedido
- número de pedido,
- fecha y hora,
- mesero,
- área,
- mesa o ubicación,
- productos,
- cantidades,
- notas,
- descuento,
- método de pago,
- estado.

### 12.4 Estados
- creado,
- enviado,
- en preparación,
- listo,
- servido,
- cobrado,
- archivado,
- cancelado.

### 12.5 Vista de cocina
Debe mostrar pedidos como tarjetas o banners expandibles. Cada tarjeta debe permitir ver todo el detalle con un toque.

### 12.6 Notificación al mesero
Cualquier cambio de estado debe notificar al mesero dueño del pedido.

---

## 13. Notificaciones en tiempo real

### 13.1 Requisitos
- funcionan aunque la web no esté en primer plano,
- sonido,
- vibración si el dispositivo lo soporta,
- mensaje claro,
- sincronización en vivo.

### 13.2 Eventos que notifican
- nuevo pedido,
- pedido listo,
- pedido en preparación,
- pedido cobrado,
- descuento aplicado,
- stock bajo,
- aviso del administrador,
- incidencias,
- cierre diario,
- diferencias.

### 13.3 Tecnología
WebSockets o Socket.IO.

---

## 14. Cobros y métodos de pago

### 14.1 Métodos
- efectivo CUP,
- efectivo USD,
- transferencia CUP,
- transferencia USD,
- Zelle,
- bancaria USD,
- pagos combinados.

### 14.2 Pagos combinados
Un pedido puede pagarse en varias partes y monedas.

### 14.3 Registro
Cada pago debe guardar:
- monto,
- moneda,
- método,
- referencia,
- fecha,
- usuario que cobró,
- pedido relacionado.

### 14.4 Descuentos
Se permite descuento porcentual sobre la comanda.

Todo descuento debe quedar auditado con:
- motivo,
- usuario,
- valor original,
- valor final.

---

## 15. Comprobante de pago

### 15.1 Función
Con un botón, el sistema genera comprobante.

### 15.2 Salida
- si hay impresora térmica: imprime,
- si no hay impresora: genera una imagen local en el dispositivo.

### 15.3 Contenido
- logo,
- nombre del restaurante,
- dirección,
- contacto,
- número de pedido,
- mesero,
- productos consumidos,
- cantidades,
- subtotal,
- descuento,
- total,
- método de pago,
- fecha y hora.

### 15.4 Diseño
Debe verse bonito, limpio y legible tanto en pantalla como en impresión.

---

## 16. Finanzas

Debe incluir:
- ingresos,
- egresos,
- ventas,
- salarios,
- gastos,
- compras,
- mermas,
- ajustes,
- resumen por día,
- resumen por rango.

### 16.1 Libro mayor
Debe existir un libro mayor simplificado o contabilidad resumida.

### 16.2 Compras
Al registrar una compra:
- puede crear movimiento en finanzas,
- puede entrar al inventario general,
- debe dejar referencia.

---

## 17. Cierre diario

### 17.1 Inicio
Un usuario autorizado abre el cierre.

### 17.2 Conteo
El sistema pide:
- denominaciones,
- cantidad por denominación,
- total por moneda,
- observaciones.

### 17.3 Resumen mostrado
- ventas totales,
- efectivo,
- transferencias,
- ventas por área,
- productos vendidos,
- mermas,
- descuentos,
- diferencia teórica vs real.

### 17.4 Guardado
Debe registrar:
- usuario,
- hora,
- fecha,
- resultados,
- diferencias,
- observaciones.

### 17.5 Bloqueo
El período puede quedar cerrado salvo permisos especiales.

---

## 18. Clientes y promociones

### 18.1 Clientes
Registrar:
- nombre,
- contacto,
- historial,
- observaciones,
- preferencias.

### 18.2 Promociones
Permite:
- promociones generales,
- ofertas por cliente,
- avisos segmentados,
- futuros programas de fidelización.

---

## 19. Ayuda integrada

El sistema debe llevar ayuda interna para:
- cómo tomar pedidos,
- cómo cobrar,
- cómo cerrar caja,
- cómo cargar inventario,
- cómo crear productos,
- cómo crear recetas,
- cómo recuperar acceso,
- qué hacer ante errores.

Debe estar disponible por módulo.

---

## 20. Auditoría y seguridad

### 20.1 Auditoría
Registrar:
- quién hizo qué,
- cuándo,
- desde dónde,
- antes y después,
- resultado de la acción.

### 20.2 Seguridad
- autenticación obligatoria,
- sesiones seguras,
- permisos por rol,
- historial de acceso,
- bloqueo temporal si se activa,
- protección de datos sensibles.

---

## 21. Imagen del proyecto y branding

Se debe crear una imagen principal de alta calidad para el software y exportarla en varias resoluciones para:
- logo,
- favicon,
- portada,
- app,
- cabecera,
- materiales visuales.

Recomendación de formato:
- cuadrado,
- horizontal,
- fondo transparente opcional,
- estilo moderno y minimalista.

---

## 22. Diseño visual

### 22.1 Estilo
- minimalista,
- moderno,
- profesional,
- claro,
- rápido,
- elegante.

### 22.2 UX
- botones claros,
- iconos bonitos,
- animaciones suaves,
- navegación simple,
- pantallas sin ruido.

### 22.3 Dispositivos
La interfaz debe adaptarse bien a:
- teléfonos,
- tablets,
- monitores,
- pantallas de cocina.

---

## 23. Migración de base de datos

### 23.1 Requisito
Comenzar con SQLite y poder migrar fácilmente a PostgreSQL o MySQL/MariaDB.

### 23.2 Cómo lograrlo
- usar ORM,
- separar lógica de acceso a datos,
- usar migraciones,
- evitar consultas atadas a un motor específico.

### 23.3 Beneficio
El proyecto puede crecer sin reescribir la mitad del backend como si fuera un castillo de naipes.

---

## 24. Respaldo y restauración

Debe existir:
- respaldo automático,
- respaldo manual,
- restauración,
- historial de copias.

Debe proteger:
- base de datos,
- configuración,
- usuarios,
- productos,
- inventarios,
- reportes.

---

## 25. Manejo de errores

El sistema debe:
- mostrar mensajes claros,
- registrar errores,
- no perder datos,
- permitir recuperación,
- evitar bloqueos innecesarios.

Casos:
- producto sin stock,
- fallo de red local,
- fallo de impresión,
- usuario sin permiso,
- sesión expirada,
- error en cierre,
- error de sincronización.

---

## 26. Funciones futuras posibles

Queda preparado para:
- mesas,
- reservas,
- delivery,
- fidelización,
- puntos,
- informes avanzados,
- exportación PDF/Excel,
- lector de códigos,
- más áreas,
- caja por turno,
- horarios,
- panel de métricas,
- app instalable.

---

## 27. Lo que no se incluye ahora

No se incluye por ahora:
- control de proveedores,
- dependencia de Internet,
- funciones que rompan el flujo local.

---

## 28. Flujo ideal resumido

1. Entra a `/`.
2. Ve noticias, menú y avisos.
3. Hace login.
4. El sistema lo manda a su área.
5. Cada área trabaja con su inventario y permisos.
6. Los pedidos se mueven en tiempo real.
7. El mesero cobra.
8. El pedido pasa al historial.
9. El cierre diario compara todo.
10. La administración ve y controla todo.

---

## 29. Criterios de éxito

El sistema será correcto si:
- el mesero trabaja rápido,
- la cocina ve pedidos claros,
- el administrador tiene control total,
- el stock no se desordena,
- el cierre diario sale limpio,
- las notificaciones llegan,
- el comprobante se genera siempre,
- el sistema sigue funcionando sin Internet,
- todo queda auditado.

---

## 30. Siguiente paso lógico

A partir de esta especificación se puede crear:
1. mapa de módulos,
2. modelo de base de datos,
3. diseño de pantallas,
4. flujo de trabajo,
5. arquitectura técnica,
6. prototipo visual,
7. plan de desarrollo por fases.

---

## 31. Conclusión

Este sistema no debe ser un POS cualquiera. Debe ser una plataforma robusta, elegante, rápida y ordenada para un restaurante en red local, pensada para el trabajo real del día a día en Cuba.

Debe tener:
- control,
- trazabilidad,
- sincronía,
- buena interfaz,
- y base sólida para crecer.

La idea es que el sistema no solo sirva.  
La idea es que organice, simplifique y dé paz al flujo operativo.

