# Repuestos Ceballos — Sistema de Gestión Integral (SGI)

Sistema de gestión comercial y operativa para talleres mecánicos y repuestos automotrices, desarrollado con arquitectura de escritorio en **Electron**, interfaz moderna en **React (Vite + Tailwind CSS)** y persistencia relacional con **SQLite y Prisma ORM**.

---

## 🚀 Módulos del Sistema

1. **Acceso y Seguridad:**
   - Autenticación con roles (Administrador, Cajero, Supervisor).
   - Control de sesiones y cierre seguro.

2. **Punto de Venta (POS):**
   - Catálogo interactivo de repuestos con búsqueda en tiempo real.
   - Carrito de compras con cálculo de subtotal, descuento y total.
   - Soporte para métodos de pago (Efectivo, Tarjeta, Transferencia).
   - Generación de comprobantes y actualización de existencias.

3. **Órdenes de Trabajo (Taller):**
   - Registro de vehículos, clientes y diagnósticos.
   - Estados de orden: *Pendiente*, *En proceso*, *Completada*, *Facturada* y *Cancelada*.
   - Control de costos estimados y facturación.

4. **Inventario de Repuestos:**
   - Catálogo de productos por categoría y código.
   - Control de existencias con alertas de stock bajo.
   - Registro rápido de entrada de mercancía.

5. **Cierre de Caja:**
   - Métricas operativas en tiempo real (ventas del día, cantidad de transacciones, efectivo esperado).
   - Conciliación de caja (efectivo contado vs. registrado).
   - Registro de incidencias y arqueo diario.

6. **Reportes:**
   - Generación de informes de ventas (Diario y Mensual).
   - Exportación de auditoría en formato PDF.

7. **Administración y Auditoría:**
   - Gestión de usuarios y credenciales.
   - Registro de trazabilidad y auditoría de eventos.

---

## 🛠️ Tecnologías

- **Frontend:** React 18, Vite, Tailwind CSS, Tabler Icons, Work Sans Font.
- **Backend / Desktop:** Electron, Node.js.
- **Base de Datos:** SQLite con Prisma ORM.
- **Seguridad:** Bcrypt, JWT, IPC handlers aislados vía `preload.js`.

---

## 📦 Instalación y Puesta en Marcha

1. Clonar el repositorio:
```bash
git clone https://github.com/WaldinCR/ProjectAutomotriz.git
cd ProjectAutomotriz/proyecto_ceballos_sgi
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar el entorno: copie `.env.example` como `.env` y defina `JWT_SECRET`
   (32+ caracteres aleatorios; el archivo explica cómo generarlo).

4. Inicializar base de datos y datos demo:
```bash
npm run db:push
npm run db:seed
```

5. Iniciar en modo desarrollo (Vite + Electron con recarga en caliente):
```bash
npm run dev
```

O compilar la interfaz y abrir la app de escritorio:
```bash
npm run build:renderer
npm start
```

6. Ejecutar las pruebas del backend (usan una base temporal, no tocan la real):
```bash
npm test
```

---

## 👥 Roles y credenciales de prueba

| Rol | Usuario | Contraseña | Acceso |
|---|---|---|---|
| Administrador | `admin` | `admin123` | Todo: inventario, usuarios, auditoría, reportes, historial de cierres |
| Cajero | `cajero` | `cajero123` | POS, órdenes de trabajo, cierre de caja, consulta de inventario |
| Supervisor | `supervisor` | `supervisor123` | Solo lectura + reportes + anulación de ventas, y API remota |

> Cambie estas contraseñas antes de usar el sistema en producción (Admin → Contraseña).

---

## 🔐 Seguridad

- La identidad y el rol del usuario viven en el proceso principal (sesión por ventana);
  el renderer nunca envía su `usuarioId`. Cada canal IPC valida el rol (`src/main/ipcHandlers.js`).
- Sesión expira tras 30 minutos de inactividad. Bloqueo de 15 minutos tras 5 intentos fallidos.
- Todos los datos de entrada se validan con zod (`src/main/core/validation.js`).
- Precios y totales se calculan en el backend; el stock se descuenta de forma atómica.
- API remota de supervisión: solo lectura y solo en `127.0.0.1` por defecto. Para acceso
  externo use un túnel cifrado (WireGuard, SSH, Cloudflare Tunnel), nunca el puerto expuesto.
- Respaldo diario (11:59 PM) y al iniciar si el último tiene más de 24 h; se conservan 30 días.

---

## 🗂️ Estructura

```
src/main/            Proceso principal (Node/Electron)
  core/              env, prisma, sesiones, roles, validación, errores, fechas
  <modulo>/          servicios de negocio (pos, inventory, workshop, cashier, reports, admin, auth, audit, backup)
  ipcHandlers.js     canales IPC con control de roles
  server.js          API REST de supervisión (solo lectura)
src/preload/         puente seguro (contextBridge)
src/renderer/        React: pages, components, services (api.js), lib, store
tests/               pruebas de reglas de negocio (node:test)
```
