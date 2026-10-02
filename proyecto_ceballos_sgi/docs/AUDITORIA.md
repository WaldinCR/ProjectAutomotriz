# Auditoría técnica — SGI Automotriz (octubre 2026)

Revisión completa del backend (Electron main + Prisma), el puente IPC, la API remota y el
frontend React, contrastada con el SRS. Rama: `devBackend`.

## Hallazgos críticos (corregidos)

| # | Problema | Riesgo | Corrección |
|---|---|---|---|
| 1 | Los canales IPC no verificaban sesión ni rol; el renderer enviaba su propio `usuarioId` | Cualquiera con la app abierta (o con DevTools) podía crear usuarios ADMIN, ver la auditoría o anular ventas en nombre de otro | Sesión en el proceso principal + roles por canal (`core/session.js`, `ipcHandlers.js`) |
| 2 | `.env` se cargaba **después** de requerir los servicios | JWT firmado con `'clave_por_defecto'`: cualquiera podía falsificar tokens de supervisor | `core/env.js` se ejecuta primero; sin secreto válido se genera uno aleatorio |
| 3 | `admin:usuarios` devolvía `passwordHash` al renderer | Exposición de hashes de contraseñas | `select` explícito sin el hash |
| 4 | Precios y subtotales venían del renderer | Venta de cualquier producto a RD$ 0.01 | Precios y totales calculados en el backend desde la BD |
| 5 | Cantidades negativas aceptadas | Una “venta” de −10 sumaba stock y restaba dinero | Validación zod (enteros ≥ 1) |
| 6 | La API Express escuchaba en todas las interfaces | Datos de ventas expuestos a la red local | `127.0.0.1` por defecto; acceso externo solo por túnel |
| 7 | `Date.utc` (no existe) en `/api/reports/mensual` | El endpoint fallaba siempre | Reescrito con servicios compartidos |
| 8 | Efectivo esperado en el cierre = total de **todas** las ventas | Cada venta con tarjeta aparecía como faltante de caja | Esperado = solo ventas en EFECTIVO |

## Integridad de datos (corregidos)

- Stock: verificación y descuento ahora son atómicos (`updateMany ... where stock >= n`); se suman líneas repetidas del mismo producto.
- OT: no validaban stock (stock negativo), aceptaban cualquier estado y podían facturarse sin completarse o estando canceladas. Ahora hay máquina de estados, cancelar devuelve repuestos y solo se factura una OT `COMPLETADA` con método de pago.
- Edición de producto permitía cambiar `stock` directamente sin movimiento; ahora solo por entrada/ajuste.
- `crearProducto` hacía `...data` directo a Prisma (asignación masiva de `id`, `activo`, etc.).
- Fechas: `new Date('AAAA-MM-DD')` es UTC; en RD (UTC−4) los reportes tomaban el día equivocado. Todo usa hora local (`core/dates.js`).
- Cierre: se permitían cierres ilimitados y ventas posteriores quedaban sin conciliar. Ahora cada cierre cubre el turno desde el cierre anterior; las ventas ya cerradas no se pueden anular.
- Backup copiaba el archivo SQLite en uso (copia potencialmente corrupta) y solo si la app estaba abierta a las 23:59. Ahora `VACUUM INTO` + respaldo al iniciar.
- Montos redondeados a 2 decimales en el backend.

## Coherencia frontend ↔ backend (corregidos)

- Errores de Electron llegaban como `Error invoking remote method...`; `Alert` intentaba limpiarlos con heurísticas. Ahora toda respuesta es `{ ok, data | error: { code, message } }` con mensajes claros.
- Menús, rutas y permisos del backend salen de una única tabla (`lib/navigation.js`). El supervisor ya no aterriza en un POS que no puede usar.
- Reportes mostraban siempre “Revisa tu carpeta…” (`res.filePath` sobre un string).
- “Stock bajo” fijo en ≤ 20 en vez del `stockMinimo` de cada producto.
- “Cierre anterior: Registrado” era texto fijo.
- 6 componentes muertos del diseño anterior eliminados; `vite.config.js` duplicado eliminado; `npm run dev` cargaba el `dist/` viejo si existía.
- Iconos se cargaban dos veces (paquete + CDN que falla sin internet). CSP agregada al build.

## Requisitos del SRS que faltaban (implementados)

RF-04 editar/desactivar usuarios · RF-05 registro de inicio de sesión · RF-06 bloqueo por intentos ·
RF-07 restablecer contraseña · RF-10 búsqueda por nombre/categoría · RF-12 descuento ·
RF-14/15 factura imprimible · RF-16 anulación (admin/supervisor) · RF-21/22 entradas y ajustes con motivo ·
RF-23 alerta de stock mínimo · RF-24 historial por producto · RF-26/48 reporte de inventario ·
RF-29 placa · RF-34 OT solo se cierra facturada · RF-38 justificación de diferencias ·
RF-40 historial de cierres · RF-46 ganancia bruta estimada · RF-50 auditoría de cambios de precio ·
RF-53 filtros de auditoría · RNF-06 expiración por inactividad · RNF-13 respaldo garantizado cada 24 h.

## Pendiente (requiere decisión del negocio)

- **ITBIS / comprobantes fiscales (NCF)**: el README anunciaba ITBIS 18 % pero nunca se calculó. Si se factura formalmente en RD hace falta definir tasas, NCF y formato DGII.
- **Rol Mecánico/Técnico** (SRS 2.3) y técnico asignado en la OT (RF-29): requiere definir el flujo.
- **Impresora térmica ESC/POS**: `node-thermal-printer` está instalado pero sin usar; hoy se imprime con el diálogo del sistema.
- **Montos en `Float`**: se redondea a 2 decimales; lo ideal a futuro es guardar centavos como enteros (migración de datos).
- **Migraciones**: se usa `prisma db push`; para producción conviene `prisma migrate`.
- **TLS en la API remota** (RNF-07): se delega al túnel; no exponer el puerto directamente.
- **Reportes con filtro por empleado/producto** (RF-47).

## Verificación

- `npm test`: 24 pruebas de reglas de negocio sobre una base SQLite temporal.
- Prueba end-to-end de la app Electron real (copia de la base): login, POS por nombre y código,
  factura, OT completa hasta facturar, permisos de cajero y supervisor, reportes PDF y respaldo.
