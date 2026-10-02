# Repuestos Ceballos — Sistema de Gestión Integral (SGI)

Sistema de gestión comercial y operativa para negocios de repuestos y talleres mecánicos en República Dominicana. Aplicación de escritorio con **Electron**, interfaz en **React (Vite + Tailwind CSS)** y base de datos local **SQLite con Prisma ORM**. Funciona sin internet.

---

## 🚀 Módulos

| Módulo | Funcionalidad |
|---|---|
| **Acceso y seguridad** | Roles (Administrador, Cajero, Supervisor, Técnico), bloqueo tras 5 intentos, sesión que expira a los 30 min, contraseñas temporales y cambio de contraseña propio |
| **Punto de venta** | Escaneo o búsqueda por nombre/categoría, descuentos, **ITBIS** calculado en el servidor, **NCF** (B01, B02, B14, B15), factura en pantalla, ticket térmico y PDF |
| **Taller** | Órdenes con placa y técnico asignado, flujo Pendiente → En proceso → Completada → Facturada, el técnico registra repuestos usados, cancelación con devolución de stock |
| **Inventario** | Productos con stock mínimo y exención de ITBIS, entradas, ajustes con motivo, historial de movimientos, alertas de reposición |
| **Caja** | Cierre por turno, efectivo esperado real (solo efectivo), justificación obligatoria de diferencias, anulaciones, comprobante de arqueo en PDF |
| **Reportes PDF** | Diario, mensual (gráficos, top productos, ganancia bruta), inventario, ventas filtradas por fecha/empleado/producto, factura y arqueo — todos con la identidad de la empresa |
| **DGII** | Exportación de formatos **607** (ventas) y **608** (anulados) |
| **Administración** | Usuarios, auditoría con filtros y detalle, datos de la empresa, secuencias NCF, impresora, respaldo manual |
| **API remota** | Supervisión de solo lectura con JWT, HTTPS opcional |

---

## 📦 Puesta en marcha (desarrollo)

```bash
git clone https://github.com/WaldinCR/ProjectAutomotriz.git
cd ProjectAutomotriz/proyecto_ceballos_sgi
npm install                 # también genera el cliente de Prisma
cp .env.example .env        # defina JWT_SECRET (ver el archivo)
npm run db:migrate          # crea/actualiza la base con las migraciones
npm run db:seed             # datos de demostración (opcional)
npm run dev                 # Vite + Electron con recarga en caliente
```

> La aplicación también aplica las migraciones pendientes **automáticamente al iniciar**, haciendo antes un respaldo de la base.

Otros comandos:

| Comando | Uso |
|---|---|
| `npm test` | 35 pruebas de reglas de negocio sobre una base temporal |
| `npm start` | Abre la app con la interfaz compilada (`npm run build:renderer` antes) |
| `npm run build` | Genera el instalador de Windows en `release/` |
| `npm run dist:dir` | Genera la app empaquetada sin instalador (para probar) |
| `npm run db:migrate:new -- --name <nombre>` | Crea una nueva migración tras cambiar `schema.prisma` |

---

## 👥 Roles y credenciales de demostración (`npm run db:seed`)

| Rol | Usuario | Contraseña | Acceso |
|---|---|---|---|
| Administrador | `admin` | `admin123` | Todo |
| Cajero | `cajero` | `cajero123` | POS, taller, cierre de caja, consulta de inventario |
| Supervisor | `supervisor` | `supervisor123` | Reportes, anulaciones, consulta, API remota |
| Técnico | *(crear en Admin)* | — | Solo sus órdenes asignadas: estados y repuestos usados |

En una instalación nueva sin usuarios se crea `admin` / `admin123` y **se exige cambiarla al primer ingreso**. Los usuarios creados por el administrador y las contraseñas restablecidas también son temporales.

---

## 🧾 Configuración fiscal (Admin › Empresa)

1. Complete nombre, **RNC** (se valida el dígito verificador), dirección y teléfono: aparecen en facturas, tickets y reportes.
2. Indique la tasa de ITBIS (18 %) y si los precios de venta **ya incluyen** el impuesto.
3. Registre las **secuencias NCF** autorizadas por la DGII (rango y vencimiento) y active *Emitir comprobantes fiscales*.
4. Marque como *exentos de ITBIS* los productos que correspondan (Inventario › Editar).

Reglas: el NCF se asigna de forma atómica, no se reutilizan números, y se bloquea la venta si la secuencia está vencida o agotada. B01, B14 y B15 exigen RNC/cédula y razón social.

## 🖨️ Impresora de tickets (Admin › Empresa)

Impresoras térmicas ESC/POS de 80 mm o 58 mm, sin controladores adicionales:

- **Red**: IP de la impresora (puerto 9100 por defecto).
- **Compartida de Windows**: comparta la impresora y use `\\localhost\NombreCompartido`.

Botón *Imprimir página de prueba* y opción de impresión automática al cobrar. Si la impresora falla, la venta se registra igual y se avisa.

---

## 🔐 Seguridad

- La identidad y el rol viven en el proceso principal; el renderer nunca envía su `usuarioId`. Cada canal IPC valida el rol (`src/main/ipcHandlers.js`).
- Todos los datos de entrada se validan con zod (`src/main/core/validation.js`). Precios, ITBIS y totales se calculan en el backend.
- CSP en la interfaz compilada; ventanas nuevas y navegación externa bloqueadas.
- **API remota**: escucha solo en `127.0.0.1`. Para acceso externo use un túnel cifrado o configure HTTPS con `REMOTE_API_TLS_CERT` y `REMOTE_API_TLS_KEY` (si el certificado no se puede leer, la API no arranca — nunca se degrada a HTTP).
- Respaldos con `VACUUM INTO`: diario (11:59 PM), al iniciar si el último tiene más de 24 h y antes de cada migración; se conservan 30 días.

## 💾 Ubicación de datos

| | Desarrollo | App instalada |
|---|---|---|
| Base de datos | `prisma/prisma/sgi_database.db` | `%APPDATA%\SGI Automotriz\sgi_database.db` |
| Configuración `.env` | raíz del proyecto | `%APPDATA%\SGI Automotriz\.env` (opcional) |
| Respaldos | `backups/` | `%APPDATA%\SGI Automotriz\backups` |
| Reportes, facturas, DGII | `Descargas\SGI Automotriz\` | `Descargas\SGI Automotriz\` |

---

## 🗂️ Estructura

```
prisma/
  schema.prisma        esquema de datos
  migrations/          migraciones versionadas (se aplican solas al iniciar)
src/main/              proceso principal (Node/Electron)
  core/                env, prisma, sesiones, roles, validación, errores, fechas, fiscal, migrador
  config/              datos de empresa, secuencias NCF
  printer/             tickets ESC/POS
  reports/             reportes y documentos; pdf/brand.js = diseño corporativo de los PDF
  assets/              logo y tipografía Work Sans (licencia OFL) para los PDF
  <módulo>/            pos, inventory, workshop, cashier, admin, auth, audit, backup
  ipcHandlers.js       canales IPC con control de roles
  server.js            API REST de supervisión
src/preload/           puente seguro (contextBridge)
src/renderer/          React: pages, components, services (api.js), lib, store
tests/                 pruebas (node:test)
docs/AUDITORIA.md      auditoría técnica y decisiones
```
