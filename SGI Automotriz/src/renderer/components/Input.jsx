import { forwardRef } from 'react';
const Input = forwardRef(function Input({
  label, value, onChange, onKeyDown, type = 'text',
  placeholder = '', disabled = false, autoFocus = false, className = ''
}, ref) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        ref={ref} type={type} value={value} onChange={onChange} onKeyDown={onKeyDown}
        placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      />
    </div>
  );
});
export default Input;
