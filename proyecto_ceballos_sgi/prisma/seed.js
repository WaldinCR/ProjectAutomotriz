require('../src/main/core/env').cargarEnv();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando la siembra (seeding) de datos...');

  // Hashing admin password
  const adminPasswordHash = await bcrypt.hash('admin123', 12);

  // Crear usuario administrador si no existe
  const admin = await prisma.usuario.upsert({
    where: { usuario: 'admin' },
    update: {},
    create: {
      nombre: 'Administrador Principal',
      usuario: 'admin',
      passwordHash: adminPasswordHash,
      rol: 'ADMINISTRADOR',
      activo: true,
    },
  });
  console.log('Usuario administrador sembrado:', admin.usuario);

  // Crear usuario supervisor si no existe (útil para probar el acceso remoto del Supervisor)
  const supervisorPasswordHash = await bcrypt.hash('supervisor123', 12);
  const supervisor = await prisma.usuario.upsert({
    where: { usuario: 'supervisor' },
    update: {},
    create: {
      nombre: 'Supervisor de Tienda',
      usuario: 'supervisor',
      passwordHash: supervisorPasswordHash,
      rol: 'SUPERVISOR',
      activo: true,
    },
  });
  console.log('Usuario supervisor sembrado:', supervisor.usuario);

  // Crear usuario cajero de prueba
  const cajero = await prisma.usuario.upsert({
    where: { usuario: 'cajero' },
    update: {},
    create: {
      nombre: 'Cajero de Turno',
      usuario: 'cajero',
      passwordHash: await bcrypt.hash('cajero123', 12),
      rol: 'CAJERO',
      activo: true,
    },
  });
  console.log('Usuario cajero sembrado:', cajero.usuario);

  // Crear productos de prueba
  const productos = [
    {
      nombre: 'Filtro de Aceite',
      codigoInterno: 'FIL-ACE-01',
      codigoBarras: '7501234567890',
      categoria: 'Repuestos',
      precioCompra: 150.00,
      precioVenta: 300.00,
      stock: 25,
      stockMinimo: 5,
      activo: true,
    },
    {
      nombre: 'Pastillas de Freno Delanteras',
      codigoInterno: 'PAS-FRE-02',
      codigoBarras: '7501234567891',
      categoria: 'Frenos',
      precioCompra: 500.00,
      precioVenta: 950.00,
      stock: 15,
      stockMinimo: 4,
      activo: true,
    },
    {
      nombre: 'Aceite de Motor 20W-50 (Galón)',
      codigoInterno: 'ACE-MOT-03',
      codigoBarras: '7501234567892',
      categoria: 'Lubricantes',
      precioCompra: 800.00,
      precioVenta: 1400.00,
      stock: 30,
      stockMinimo: 8,
      activo: true,
    },
    {
      nombre: 'Batería 12V L-24',
      codigoInterno: 'BAT-12V-04',
      codigoBarras: '7501234567893',
      categoria: 'Eléctrico',
      precioCompra: 2500.00,
      precioVenta: 4500.00,
      stock: 10,
      stockMinimo: 2,
      activo: true,
    },
    {
      nombre: 'Bujía Bosch',
      codigoInterno: 'BUJ-BOS-05',
      codigoBarras: '7501234567894',
      categoria: 'Ignición',
      precioCompra: 80.00,
      precioVenta: 180.00,
      stock: 100,
      stockMinimo: 20,
      activo: true,
    }
  ];

  for (const prod of productos) {
    const existente = await prisma.producto.findUnique({ where: { codigoInterno: prod.codigoInterno } });
    if (existente) continue;
    const creado = await prisma.producto.create({ data: prod });
    // El stock inicial queda registrado como movimiento, igual que desde la app
    await prisma.movimientoInventario.create({
      data: { productoId: creado.id, usuarioId: admin.id, tipo: 'ENTRADA', cantidad: prod.stock, motivo: 'Stock inicial' },
    });
  }
  console.log('Productos de prueba sembrados.');
}

main()
  .catch((e) => {
    console.error('Error al sembrar datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
