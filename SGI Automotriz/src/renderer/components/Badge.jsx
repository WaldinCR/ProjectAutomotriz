const colors = {
  CONFIRMADA: 'bg-green-100 text-green-800', ANULADA: 'bg-red-100 text-red-800',
  PENDIENTE: 'bg-yellow-100 text-yellow-800', EN_PROCESO: 'bg-blue-100 text-blue-800',
  COMPLETADA: 'bg-purple-100 text-purple-800', FACTURADA: 'bg-green-100 text-green-800',
  ADMINISTRADOR: 'bg-blue-100 text-blue-800', CAJERO: 'bg-gray-100 text-gray-800',
  SUPERVISOR: 'bg-orange-100 text-orange-800',
};
export default function Badge({ label }) {
  const style = colors[label] || 'bg-gray-100 text-gray-700';
  return <span className={`${style} px-2.5 py-0.5 rounded-full text-xs font-semibold`}>{label}</span>;
}
