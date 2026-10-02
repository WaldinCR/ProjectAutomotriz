// Factura en pantalla (RF-14 / RF-15) con datos de la empresa, NCF e ITBIS.
// Imprimir: impresora térmica si está configurada; si no, diálogo del sistema.
// PDF: factura con la identidad de la empresa (src/main/reports/pdf).
import { useState } from 'react';
import Modal from './Modal';
import Alert from './Alert';
import { rd, fechaHora } from '../lib/format';
import { useConfigStore } from '../store/configStore';
import { imprimirTicket } from '../services/configService';
import { facturaPdf, generarYAbrir } from '../services/reportsService';
import { TIPOS_COMPROBANTE } from './ComprobanteFields';

function Fila({ etiqueta, valor, estilo }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', ...estilo }}>
      <span>{etiqueta}</span><span style={{ textAlign: 'right' }}>{valor}</span>
    </div>
  );
}

export default function Receipt({ venta, onClose, titulo = 'Venta registrada' }) {
  const { config } = useConfigStore();
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  if (!venta) return null;

  const termica = config && config.impresoraTipo !== 'NINGUNA';
  const bruto = venta.detalles.reduce((s, d) => s + d.subtotal, 0);
  const tipo = TIPOS_COMPROBANTE.find(t => t.tipo === venta.tipoComprobante);
  const impresionFallida = venta.impresion && !venta.impresion.ok;
  const cerrar = () => { setAviso(null); onClose(); };

  async function accion(fn, exito) {
    setOcupado(true);
    try {
      await fn();
      if (exito) setAviso({ type: 'success', message: exito });
    } catch (e) {
      setAviso({ type: 'error', message: e.message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal open title={titulo} onClose={cerrar} size="sm">
      {impresionFallida && !aviso && (
        <Alert type="warning" message={`La venta se registró, pero el ticket no se imprimió: ${venta.impresion.mensaje}`} />
      )}
      {aviso && <Alert type={aviso.type} message={aviso.message} onClose={() => setAviso(null)} />}
      <div className="receipt">
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>{(config?.nombreEmpresa || 'Repuestos Ceballos').toUpperCase()}</div>
        {config?.eslogan && <div style={{ textAlign: 'center' }}>{config.eslogan}</div>}
        {config?.rnc && <div style={{ textAlign: 'center' }}>RNC {config.rnc}</div>}
        {config?.direccion && <div style={{ textAlign: 'center' }}>{config.direccion}</div>}
        {config?.telefono && <div style={{ textAlign: 'center' }}>Tel. {config.telefono}</div>}
        <hr />
        <div style={{ textAlign: 'center', fontWeight: 700 }}>{tipo ? `FACTURA DE ${tipo.nombre.toUpperCase()}` : 'FACTURA'}</div>
        {venta.ncf && <div style={{ textAlign: 'center' }}>NCF: <strong>{venta.ncf}</strong></div>}
        <Fila etiqueta="Factura:" valor={<strong>{venta.numeroFactura}</strong>} />
        <Fila etiqueta="Fecha:" valor={fechaHora(venta.fecha)} />
        <Fila etiqueta="Vendedor:" valor={venta.usuario?.nombre} />
        {venta.clienteNombre && <Fila etiqueta="Cliente:" valor={venta.clienteNombre} />}
        {venta.clienteRnc && <Fila etiqueta="RNC/Céd.:" valor={venta.clienteRnc} />}
        {venta.ordenTrabajo && <Fila etiqueta="Orden:" valor={`#${venta.ordenTrabajo.id} ${venta.ordenTrabajo.placa || ''}`} />}
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
        {venta.descuento > 0 && <Fila etiqueta="Importe" valor={rd(bruto)} />}
        {venta.descuento > 0 && <Fila etiqueta="Descuento" valor={`-${rd(venta.descuento)}`} />}
        <Fila etiqueta="Subtotal" valor={rd(venta.subtotal)} />
        <Fila etiqueta={`ITBIS (${Math.round((config?.tasaItbis ?? 0.18) * 100)}%)`} valor={rd(venta.itbis)} />
        <Fila etiqueta="TOTAL" valor={rd(venta.total)} estilo={{ fontWeight: 700, fontSize: '14px' }} />
        <Fila etiqueta="Pago" valor={venta.metodoPago} />
        {venta.estado === 'ANULADA' && <div style={{ textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>*** ANULADA ***</div>}
        <hr />
        {!venta.ncf && <div style={{ textAlign: 'center' }}>Documento sin valor fiscal</div>}
        <div style={{ textAlign: 'center' }}>{config?.piePagina || '¡Gracias por su compra!'}</div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={cerrar}>Cerrar</button>
        <button className="btn btn-ghost" disabled={ocupado} onClick={() => accion(() => generarYAbrir(() => facturaPdf(venta.id)))}>
          <i className="ti ti-file-type-pdf"></i>PDF
        </button>
        <button
          className="btn btn-dark" autoFocus disabled={ocupado}
          onClick={() => (termica ? accion(() => imprimirTicket(venta.id), 'Ticket enviado a la impresora') : window.print())}
        >
          <i className="ti ti-printer"></i>{termica ? 'Imprimir ticket' : 'Imprimir'}
        </button>
      </div>
    </Modal>
  );
}
