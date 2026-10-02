// Mensaje de estado. Los textos ya llegan claros desde el proceso principal (RNF-11).
const ESTILOS = {
  info:    'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error:   'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
};

export default function Alert({ type = 'info', message, onClose }) {
  if (!message) return null;
  return (
    <div role="alert" className={`${ESTILOS[type]} border rounded-lg px-4 py-3 flex items-start gap-3 text-sm mb-4`}>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} aria-label="Cerrar" className="text-current opacity-50 hover:opacity-100 font-bold leading-none mt-0.5">
          ×
        </button>
      )}
    </div>
  );
}
