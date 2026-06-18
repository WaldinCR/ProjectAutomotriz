import { forwardRef } from 'react';
const Input = forwardRef(function Input({
  label, value, onChange, onKeyDown, type = 'text',
  placeholder = '', disabled = false, autoFocus = false, className = '',
  error = ''
}, ref) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className={`text-sm font-medium ${error ? 'text-red-650' : 'text-gray-700'}`}>{label}</label>}
      <input
        ref={ref} type={type} value={value} onChange={onChange} onKeyDown={onKeyDown}
        placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
        className={`border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 transition
          ${error
            ? 'border-red-400 focus:ring-red-100 focus:border-red-500 bg-red-50/10'
            : 'border-slate-200 focus:ring-[#111827]/10 focus:border-[#111827] bg-white text-slate-900'
          }`}
      />
      {error && <span className="text-xs text-red-500 font-medium mt-0.5">{error}</span>}
    </div>
  );
});
export default Input;

