// Campo de formulario con etiqueta y mensaje de error, con el estilo del diseño (.lbl / .inp)
export default function Field({ label, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="lbl">{label}</label>}
      {children}
      {error && <span className="field-err">{error}</span>}
    </div>
  );
}
