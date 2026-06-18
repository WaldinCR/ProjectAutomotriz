export default function Alert({ type = 'info', message, onClose }) {
  if (!message) return null;
  const styles = {
    info:    'bg-blue-50   border-blue-300   text-blue-800',
    success: 'bg-green-50  border-green-300  text-green-800',
    error:   'bg-red-50    border-red-300    text-red-800',
    warning: 'bg-orange-50 border-orange-300 text-orange-800',
  };
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  return (
    <div className={`${styles[type]} border rounded-lg px-4 py-3 flex items-start gap-3 text-sm mb-4`}>
      <span>{icons[type]}</span>
      <span className="flex-1">{message}</span>
      {onClose && <button onClick={onClose} className="text-current opacity-60 hover:opacity-100">×</button>}
    </div>
  );
}
