// Factura imprimible (RF-14 / RF-15): número, fecha, artículos, precios, total y vendedor.
// Al imprimir, solo este bloque es visible (ver @media print en index.css).
import Modal from './Modal';
import { rd, fechaHora } from '../lib/format';

export default function Receipt({ venta, onClose }) {
  if (!venta) return null;
  const subtotal = venta.detalles.reduce((s, d) => s + d.subtotal, 0);

  return (
    <Modal open title="Venta registrada" onClose={onClose} size="sm">
      <div className="receipt">
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>REPUESTOS CEBALLOS</div>
        <div style={{ textAlign: 'center' }}>Repuestos y Taller Automotriz</div>
        <hr />
        <div>Factura: <strong>{venta.numeroFactura}</strong></div>
        <div>Fecha:   {fechaHora(venta.fecha)}</div>
        <div>Vendedor: {venta.usuario?.nombre}</div>
        <hr />
        <table>
          <tbody>
            {venta.detalles.map(d => (
              <tr key={d.id}>
                <td>
                  {d.producto?.nombre || d.servicio}
                  <div className="muted">{d.cantidad} x {rd(d.precioUnitario)}{d.descuento > 0 && ` (-${rd(d.descuento)})`}</div>
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'top' }}>{rd(d.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        {venta.descuento > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{rd(subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Descuento</span><span>-{rd(venta.descuento)}</span></div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px' }}>
          <span>TOTAL</span><span>{rd(venta.total)}</span>
        </div>
        <div>Pago: {venta.metodoPago}</div>
        <hr />
        <div style={{ textAlign: 'center' }}>¡Gracias por su compra!</div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        <button className="btn btn-dark" onClick={() => window.print()} autoFocus>
          <i className="ti ti-printer"></i>Imprimir
        </button>
      </div>
    </Modal>
  );
}
