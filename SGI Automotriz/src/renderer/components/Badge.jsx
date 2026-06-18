const map = {
  CONFIRMADA:    'badge-green',
  ANULADA:       'badge-red',
  PENDIENTE:     'badge-yellow',
  EN_PROCESO:    'badge-blue',
  COMPLETADA:    'badge-purple',
  FACTURADA:     'badge-green',
  ADMINISTRADOR: 'badge-blue',
  CAJERO:        'badge-gray',
  SUPERVISOR:    'badge-yellow',
  ACTIVO:        'badge-green',
  INACTIVO:      'badge-red',
};

export default function Badge({ label }) {
  return (
    <span className={map[label] || 'badge-gray'}>
      {label}
    </span>
  );
}
