// Roles del sistema y permisos por acción (SRS 2.3)
const ROLES = {
  ADMIN: 'ADMINISTRADOR',
  CAJERO: 'CAJERO',
  SUPERVISOR: 'SUPERVISOR',
  TECNICO: 'TECNICO',
};

const TODOS = Object.values(ROLES);
const OPERADORES = [ROLES.ADMIN, ROLES.CAJERO];
const SOLO_ADMIN = [ROLES.ADMIN];
const ADMIN_SUPERVISOR = [ROLES.ADMIN, ROLES.SUPERVISOR];
// Personal administrativo/comercial (todos menos el técnico de taller)
const GESTION = [ROLES.ADMIN, ROLES.CAJERO, ROLES.SUPERVISOR];
// Quienes trabajan sobre las órdenes del taller
const TALLER = [ROLES.ADMIN, ROLES.CAJERO, ROLES.TECNICO];

module.exports = { ROLES, TODOS, OPERADORES, SOLO_ADMIN, ADMIN_SUPERVISOR, GESTION, TALLER };
