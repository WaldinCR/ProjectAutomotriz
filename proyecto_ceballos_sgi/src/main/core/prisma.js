// Cliente Prisma único para todo el proceso principal.
// Varias instancias abren varias conexiones a SQLite y provocan bloqueos.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
