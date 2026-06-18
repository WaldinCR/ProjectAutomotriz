// Servicio de Autenticación
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'clave_por_defecto';
const SALT_ROUNDS = 12;

async function login({ usuario, password }) {
  const user = await prisma.usuario.findUnique({ where: { usuario } });
  if (!user || !user.activo) throw new Error('Usuario no encontrado o inactivo');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Contraseña incorrecta');

  const token = jwt.sign(
    { id: user.id, rol: user.rol, nombre: user.nombre },
    JWT_SECRET,
    { expiresIn: '30m' }
  );

  return { token, usuario: { id: user.id, nombre: user.nombre, rol: user.rol } };
}

async function crearUsuario({ nombre, usuario, password, rol }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  return prisma.usuario.create({
    data: { nombre, usuario, passwordHash, rol }
  });
}

function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { login, crearUsuario, verificarToken };
