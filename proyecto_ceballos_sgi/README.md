# Repuestos Ceballos — Sistema de Gestión Integral (SGI)

Sistema de gestión comercial y operativa para talleres mecánicos y repuestos automotrices, desarrollado con arquitectura de escritorio en **Electron**, interfaz moderna en **React (Vite + Tailwind CSS)** y persistencia relacional con **SQLite y Prisma ORM**.

---

## 🚀 Módulos del Sistema

1. **Acceso y Seguridad:**
   - Autenticación con roles (Administrador, Cajero).
   - Control de sesiones y cierre seguro.

2. **Punto de Venta (POS):**
   - Catálogo interactivo de repuestos con búsqueda en tiempo real.
   - Carrito de compras con cálculo de subtotal, ITBIS (18%) y total.
   - Soporte para métodos de pago (Efectivo, Tarjeta, Transferencia).
   - Generación de comprobantes y actualización de existencias.

3. **Órdenes de Trabajo (Taller):**
   - Registro de vehículos, clientes y diagnósticos.
   - Estados de orden: *En proceso*, *Listo* y *Cerrada*.
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
cd ProjectAutomotriz
```

2. Instalar dependencias:
```bash
npm install
```

3. Inicializar base de datos y datos demo:
```bash
npx prisma db push
node prisma/seed.js
```

4. Iniciar la aplicación en modo desarrollo:
```bash
npm run dev
```

O iniciar la app en modo escritorio:
```bash
npm start
```

---

## 👥 Credenciales Iniciales

- **Administrador:**
  - Usuario: `admin`
  - Contraseña: `admin123`
- **Cajero:**
  - Usuario: `cajero`
  - Contraseña: `cajero123`
