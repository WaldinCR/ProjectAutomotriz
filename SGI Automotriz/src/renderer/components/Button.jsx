export default function Button({
  children, onClick, type = 'button',
  variant = 'primary', size = 'md',
  disabled = false, className = ''
}) {
  const variants = {
    primary: 'bg-blue-800 hover:bg-blue-700 text-white',
    success: 'bg-green-700 hover:bg-green-600 text-white',
    danger:  'bg-red-600  hover:bg-red-500  text-white',
    warning: 'bg-orange-500 hover:bg-orange-400 text-white',
    ghost:   'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${variants[variant]} ${sizes[size]} rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
      {children}
    </button>
  );
}
