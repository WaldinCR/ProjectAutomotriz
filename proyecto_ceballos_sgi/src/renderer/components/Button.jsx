export default function Button({
  children, onClick, type = 'button',
  variant = 'primary', size = 'md',
  disabled = false, className = ''
}) {
  const variants = {
    primary: 'btn-primary',
    success: 'btn-success',
    danger:  'btn-danger',
    warning: 'btn-warning',
    ghost:   'btn-secondary',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}
