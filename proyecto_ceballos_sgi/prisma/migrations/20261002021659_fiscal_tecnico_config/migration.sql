-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nombreEmpresa" TEXT NOT NULL DEFAULT 'Repuestos Ceballos',
    "eslogan" TEXT DEFAULT 'Repuestos y Taller Automotriz',
    "rnc" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "tasaItbis" REAL NOT NULL DEFAULT 0.18,
    "preciosIncluyenItbis" BOOLEAN NOT NULL DEFAULT true,
    "emitirNcf" BOOLEAN NOT NULL DEFAULT false,
    "impresoraTipo" TEXT NOT NULL DEFAULT 'NINGUNA',
    "impresoraDestino" TEXT,
    "impresoraAncho" INTEGER NOT NULL DEFAULT 48,
    "imprimirAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "piePagina" TEXT DEFAULT '¡Gracias por su compra!',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SecuenciaNcf" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "siguiente" INTEGER NOT NULL DEFAULT 1,
    "hasta" INTEGER NOT NULL,
    "vencimiento" DATETIME,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DetalleVenta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "servicio" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "descuento" REAL NOT NULL DEFAULT 0,
    "itbis" REAL NOT NULL DEFAULT 0,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "DetalleVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DetalleVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DetalleVenta" ("cantidad", "descuento", "id", "precioUnitario", "productoId", "servicio", "subtotal", "ventaId") SELECT "cantidad", "descuento", "id", "precioUnitario", "productoId", "servicio", "subtotal", "ventaId" FROM "DetalleVenta";
DROP TABLE "DetalleVenta";
ALTER TABLE "new_DetalleVenta" RENAME TO "DetalleVenta";
CREATE TABLE "new_OrdenTrabajo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehiculo" TEXT NOT NULL,
    "placa" TEXT,
    "cliente" TEXT NOT NULL,
    "telefono" TEXT,
    "descripcion" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "tecnicoId" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "total" REAL NOT NULL DEFAULT 0,
    "fechaCreacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ventaId" INTEGER,
    CONSTRAINT "OrdenTrabajo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrdenTrabajo_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrdenTrabajo_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrdenTrabajo" ("cliente", "descripcion", "estado", "fechaCreacion", "id", "placa", "telefono", "total", "updatedAt", "usuarioId", "vehiculo", "ventaId") SELECT "cliente", "descripcion", "estado", "fechaCreacion", "id", "placa", "telefono", "total", "updatedAt", "usuarioId", "vehiculo", "ventaId" FROM "OrdenTrabajo";
DROP TABLE "OrdenTrabajo";
ALTER TABLE "new_OrdenTrabajo" RENAME TO "OrdenTrabajo";
CREATE UNIQUE INDEX "OrdenTrabajo_ventaId_key" ON "OrdenTrabajo"("ventaId");
CREATE INDEX "OrdenTrabajo_fechaCreacion_idx" ON "OrdenTrabajo"("fechaCreacion");
CREATE INDEX "OrdenTrabajo_tecnicoId_idx" ON "OrdenTrabajo"("tecnicoId");
CREATE TABLE "new_Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "codigoInterno" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "precioCompra" REAL NOT NULL,
    "precioVenta" REAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,
    "exentoItbis" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Producto" ("activo", "categoria", "codigoBarras", "codigoInterno", "createdAt", "id", "nombre", "precioCompra", "precioVenta", "stock", "stockMinimo", "updatedAt") SELECT "activo", "categoria", "codigoBarras", "codigoInterno", "createdAt", "id", "nombre", "precioCompra", "precioVenta", "stock", "stockMinimo", "updatedAt" FROM "Producto";
DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");
CREATE UNIQUE INDEX "Producto_codigoInterno_key" ON "Producto"("codigoInterno");
CREATE TABLE "new_Venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numeroFactura" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "itbis" REAL NOT NULL DEFAULT 0,
    "descuento" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "tipoComprobante" TEXT,
    "ncf" TEXT,
    "clienteNombre" TEXT,
    "clienteRnc" TEXT,
    "metodoPago" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "motivoAnulacion" TEXT,
    CONSTRAINT "Venta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Venta" ("descuento", "estado", "fecha", "id", "metodoPago", "motivoAnulacion", "numeroFactura", "total", "usuarioId") SELECT "descuento", "estado", "fecha", "id", "metodoPago", "motivoAnulacion", "numeroFactura", "total", "usuarioId" FROM "Venta";
DROP TABLE "Venta";
ALTER TABLE "new_Venta" RENAME TO "Venta";
CREATE UNIQUE INDEX "Venta_numeroFactura_key" ON "Venta"("numeroFactura");
CREATE UNIQUE INDEX "Venta_ncf_key" ON "Venta"("ncf");
CREATE INDEX "Venta_fecha_idx" ON "Venta"("fecha");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SecuenciaNcf_tipo_key" ON "SecuenciaNcf"("tipo");

-- Datos existentes: las ventas anteriores no registraron ITBIS. Se conserva el
-- total tal cual (subtotal = total, itbis = 0) en lugar de inventar impuestos.
UPDATE "Venta" SET "subtotal" = "total" + "descuento" WHERE "subtotal" = 0;
UPDATE "DetalleVenta" SET "itbis" = 0;

-- Configuración inicial de la empresa
INSERT INTO "Configuracion" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);
