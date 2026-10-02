import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import Field from '../components/Field';
import {
  listarProductos, crearProducto, editarProducto, registrarEntrada, registrarAjuste, movimientos,
} from '../services/inventoryService';
import { useAuthStore, ROLES } from '../store/authStore';
import { rd, fechaHora } from '../lib/format';

const VACIO = { nombre: '', codigoBarras: '', categoria: '', precioCompra: '', precioVenta: '', stock: '0', stockMinimo: '5' };

// Validación en pantalla; el proceso principal vuelve a validar todo
function validarProducto(f, esNuevo) {
  const err = {};
  const num = (v) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0;
  if (!f.nombre.trim()) err.nombre = 'El nombre es requerido';
  if (!f.categoria.trim()) err.categoria = 'La categoría es requerida';
  if (!num(f.precioCompra)) err.precioCompra = 'Ingrese un precio válido';
  if (!num(f.precioVenta)) err.precioVenta = 'Ingrese un precio válido';
  else if (num(f.precioCompra) && Number(f.precioVenta) < Number(f.precioCompra)) err.precioVenta = 'No puede ser menor que el precio de compra';
  if (esNuevo && (!num(f.stock) || !Number.isInteger(Number(f.stock)))) err.stock = 'Ingrese una cantidad entera';
  if (!num(f.stockMinimo) || !Number.isInteger(Number(f.stockMinimo))) err.stockMinimo = 'Ingrese una cantidad entera';
  return err;
}

function estadoStock(p) {
  if (p.stock <= 0) return { color: '#dc2626', texto: '0 (Agotado)' };
  if (p.stock <= p.stockMinimo) return { color: '#b45309', texto: p.stock, alerta: true };
  return { color: '#166534', texto: p.stock };
}

function categoriaBadge(categoria) {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('lubricant')) return 'bg-blue';
  if (cat.includes('freno')) return 'bg-red';
  if (cat.includes('electr')) return 'bg-purple';
  if (cat.includes('ignic')) return 'bg-orange';
  return 'bg-gray';
}

export default function InventoryPage() {
  const { tieneRol } = useAuthStore();
  const esAdmin = tieneRol(ROLES.ADMIN);
  const puedeVerHistorial = tieneRol(ROLES.ADMIN, ROLES.SUPERVISOR);

  const [productos, setProductos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [soloBajos, setSoloBajos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerta, setAlerta] = useState(null);

  // Modal de producto: { modo: 'nuevo' | 'editar', form, errors, error }
  const [modalProducto, setModalProducto] = useState(null);
  // Modal de movimiento: { tipo: 'ENTRADA' | 'AJUSTE', producto, cantidad, motivo, error }
  const [modalMov, setModalMov] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, [verInactivos]);

  async function cargar() {
    setLoading(true);
    try {
      setProductos(await listarProductos({ incluirInactivos: verInactivos }));
    } catch (e) {
      setAlerta({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  function abrirEditar(p) {
    setModalProducto({
      modo: 'editar',
      id: p.id,
      form: {
        nombre: p.nombre, codigoBarras: p.codigoBarras || '', categoria: p.categoria,
        precioCompra: String(p.precioCompra), precioVenta: String(p.precioVenta),
        stockMinimo: String(p.stockMinimo), activo: p.activo,
      },
      errors: {},
    });
  }

  function setCampo(campo, valor) {
    setModalProducto(m => ({ ...m, form: { ...m.form, [campo]: valor }, errors: { ...m.errors, [campo]: '' } }));
  }

  async function guardarProducto() {
    const { modo, form, id } = modalProducto;
    const errors = validarProducto(form, modo === 'nuevo');
    if (Object.keys(errors).length) return setModalProducto(m => ({ ...m, errors }));

    const datos = {
      nombre: form.nombre,
      categoria: form.categoria,
      codigoBarras: form.codigoBarras,
      precioCompra: Number(form.precioCompra),
      precioVenta: Number(form.precioVenta),
      stockMinimo: Number(form.stockMinimo),
    };
    setGuardando(true);
    try {
      if (modo === 'nuevo') await crearProducto({ ...datos, stock: Number(form.stock) });
      else await editarProducto({ ...datos, id, activo: form.activo });
      setAlerta({ type: 'success', msg: modo === 'nuevo' ? 'Producto creado' : 'Producto actualizado' });
      setModalProducto(null);
      cargar();
    } catch (e) {
      setModalProducto(m => ({ ...m, error: e.message }));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarMovimiento() {
    const { tipo, producto, cantidad, motivo } = modalMov;
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n === 0 || (tipo === 'ENTRADA' && n < 0)) {
      return setModalMov(m => ({ ...m, error: tipo === 'ENTRADA' ? 'Ingrese una cantidad entera mayor a 0' : 'Ingrese una cantidad entera distinta de 0' }));
    }
    if (tipo === 'AJUSTE' && !motivo.trim()) {
      return setModalMov(m => ({ ...m, error: 'El motivo del ajuste es obligatorio' }));
    }
    setGuardando(true);
    try {
      const datos = { productoId: producto.id, cantidad: n, motivo: motivo.trim() || undefined };
      if (tipo === 'ENTRADA') await registrarEntrada(datos);
      else await registrarAjuste(datos);
      setAlerta({ type: 'success', msg: `${tipo === 'ENTRADA' ? 'Entrada' : 'Ajuste'} registrado para ${producto.nombre}` });
      setModalMov(null);
      cargar();
    } catch (e) {
      setModalMov(m => ({ ...m, error: e.message }));
    } finally {
      setGuardando(false);
    }
  }

  async function verHistorial(p) {
    setHistorial({ producto: p, items: null });
    try {
      setHistorial({ producto: p, items: await movimientos(p.id) });
    } catch (e) {
      setHistorial(null);
      setAlerta({ type: 'error', msg: e.message });
    }
  }

  const bajos = productos.filter(p => p.activo && p.stock <= p.stockMinimo);
  const q = filtro.toLowerCase();
  const filtrados = productos.filter(p =>
    (!soloBajos || p.stock <= p.stockMinimo) && (
      p.nombre.toLowerCase().includes(q) ||
      (p.codigoBarras || '').includes(filtro) ||
      p.codigoInterno.toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q)
    ));

  const f = modalProducto?.form;
  const e = modalProducto?.errors || {};

  return (
    <PageLayout
      title="Inventario"
      subtitle={esAdmin ? 'Gestión y control de productos en stock' : 'Consulta de productos y existencias'}
      actions={esAdmin && (
        <button className="btn btn-dark" onClick={() => setModalProducto({ modo: 'nuevo', form: VACIO, errors: {} })}>
          <i className="ti ti-plus"></i>Nuevo producto
        </button>
      )}
    >
      {alerta && (
        <div style={{ marginBottom: '14px' }}>
          <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />
        </div>
      )}

      {/* RF-23: alerta visible de stock bajo */}
      {bajos.length > 0 && (
        <div className="warn-strip">
          <i className="ti ti-alert-triangle"></i>
          <span style={{ flex: 1 }}>
            {bajos.length} producto(s) en o por debajo del stock mínimo.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setSoloBajos(s => !s)}>
            {soloBajos ? 'Ver todos' : 'Ver solo estos'}
          </button>
        </div>
      )}

      <div className="search-row">
        <i className="ti ti-search"></i>
        <input
          type="text"
          placeholder="Buscar por nombre, código o categoría..."
          value={filtro}
          onChange={ev => setFiltro(ev.target.value)}
        />
        {esAdmin && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={verInactivos} onChange={ev => setVerInactivos(ev.target.checked)} />
            Incluir inactivos
          </label>
        )}
      </div>

      <div className="tbl-wrap">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><Spinner /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cód. interno</th>
                <th>Cód. barras</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock / mín.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No hay productos que coincidan
                  </td>
                </tr>
              ) : filtrados.map(p => {
                const s = estadoStock(p);
                return (
                  <tr key={p.id} style={p.activo ? undefined : { opacity: 0.5 }}>
                    <td className="td-mono">{p.codigoInterno}</td>
                    <td className="td-mono" style={{ color: p.codigoBarras ? '#64748b' : '#94a3b8' }}>{p.codigoBarras || '—'}</td>
                    <td className="td-bold">
                      {p.nombre}
                      {!p.activo && <span className="badge bg-gray" style={{ marginLeft: '6px' }}>Inactivo</span>}
                    </td>
                    <td><span className={`badge ${categoriaBadge(p.categoria)}`}>{p.categoria}</span></td>
                    <td>{rd(p.precioVenta)}</td>
                    <td>
                      <span style={{ color: s.color, fontWeight: 600 }}>
                        {s.texto} {s.alerta && <i className="ti ti-alert-triangle" style={{ fontSize: '13px' }}></i>}
                      </span>
                      <span className="muted"> / {p.stockMinimo}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {esAdmin && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => setModalMov({ tipo: 'ENTRADA', producto: p, cantidad: '', motivo: '' })}>
                              <i className="ti ti-plus" style={{ fontSize: '12px' }}></i>Entrada
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setModalMov({ tipo: 'AJUSTE', producto: p, cantidad: '', motivo: '' })}>
                              Ajuste
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)} title="Editar">
                              <i className="ti ti-pencil" style={{ fontSize: '12px' }}></i>
                            </button>
                          </>
                        )}
                        {puedeVerHistorial && (
                          <button className="btn btn-ghost btn-sm" onClick={() => verHistorial(p)} title="Historial de movimientos">
                            <i className="ti ti-history" style={{ fontSize: '12px' }}></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', gap: '18px', marginTop: '12px', padding: '10px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '9px', fontSize: '12px', color: '#475569' }}>
        <span><span style={{ color: '#166534' }}>●</span> Stock sobre el mínimo</span>
        <span><span style={{ color: '#b45309' }}>●</span> En o bajo el mínimo</span>
        <span><span style={{ color: '#dc2626' }}>●</span> Agotado</span>
      </div>

      {/* Modal crear / editar producto */}
      <Modal open={!!modalProducto} title={modalProducto?.modo === 'nuevo' ? 'Nuevo producto' : 'Editar producto'} onClose={() => setModalProducto(null)} size="lg">
        {f && (
          <>
            {modalProducto.error && <Alert type="error" message={modalProducto.error} />}
            <div className="form-grid">
              <Field label="Nombre del producto" error={e.nombre}>
                <input className="inp" value={f.nombre} onChange={ev => setCampo('nombre', ev.target.value)} autoFocus />
              </Field>
              <Field label="Código de barras (opcional)">
                <input className="inp" value={f.codigoBarras} onChange={ev => setCampo('codigoBarras', ev.target.value)} />
              </Field>
              <Field label="Categoría" error={e.categoria}>
                <input className="inp" placeholder="Ej: Repuestos, Lubricantes, Frenos..." value={f.categoria} onChange={ev => setCampo('categoria', ev.target.value)} />
              </Field>
              <Field label="Stock mínimo" error={e.stockMinimo}>
                <input className="inp" type="number" min="0" value={f.stockMinimo} onChange={ev => setCampo('stockMinimo', ev.target.value)} />
              </Field>
              <Field label="Precio compra (RD$)" error={e.precioCompra}>
                <input className="inp" type="number" min="0" step="0.01" value={f.precioCompra} onChange={ev => setCampo('precioCompra', ev.target.value)} />
              </Field>
              <Field label="Precio venta (RD$)" error={e.precioVenta}>
                <input className="inp" type="number" min="0" step="0.01" value={f.precioVenta} onChange={ev => setCampo('precioVenta', ev.target.value)} />
              </Field>
              {modalProducto.modo === 'nuevo' ? (
                <Field label="Stock inicial" error={e.stock}>
                  <input className="inp" type="number" min="0" value={f.stock} onChange={ev => setCampo('stock', ev.target.value)} />
                </Field>
              ) : (
                <Field label="Estado">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', paddingTop: '8px' }}>
                    <input type="checkbox" checked={f.activo} onChange={ev => setCampo('activo', ev.target.checked)} />
                    Producto activo (visible en ventas)
                  </label>
                </Field>
              )}
            </div>
            {modalProducto.modo === 'editar' && (
              <p className="muted" style={{ fontSize: '12px', marginTop: '10px' }}>
                El stock no se edita aquí: use “Entrada” o “Ajuste” para que el movimiento quede registrado.
              </p>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalProducto(null)}>Cancelar</button>
              <button className="btn btn-dark" onClick={guardarProducto} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal entrada / ajuste */}
      <Modal open={!!modalMov} title={`${modalMov?.tipo === 'ENTRADA' ? 'Entrada de stock' : 'Ajuste de inventario'}: ${modalMov?.producto.nombre}`} onClose={() => setModalMov(null)} size="sm">
        {modalMov && (
          <>
            {modalMov.error && <Alert type="error" message={modalMov.error} />}
            <p className="muted" style={{ fontSize: '12px', marginBottom: '10px' }}>Stock actual: <strong>{modalMov.producto.stock}</strong></p>
            <Field label={modalMov.tipo === 'ENTRADA' ? 'Cantidad recibida' : 'Cantidad (+ suma, − resta)'} className="mb-3">
              <input
                className="inp" type="number" autoFocus
                min={modalMov.tipo === 'ENTRADA' ? 1 : undefined}
                value={modalMov.cantidad}
                onChange={ev => setModalMov(m => ({ ...m, cantidad: ev.target.value, error: '' }))}
              />
            </Field>
            <Field label={modalMov.tipo === 'ENTRADA' ? 'Motivo (opcional)' : 'Motivo (obligatorio)'}>
              <input
                className="inp"
                placeholder={modalMov.tipo === 'ENTRADA' ? 'Ej: Compra a proveedor, devolución...' : 'Ej: Conteo físico, producto dañado...'}
                value={modalMov.motivo}
                onChange={ev => setModalMov(m => ({ ...m, motivo: ev.target.value, error: '' }))}
              />
            </Field>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalMov(null)}>Cancelar</button>
              <button className="btn btn-success" onClick={guardarMovimiento} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar'}</button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal historial (RF-24) */}
      <Modal open={!!historial} title={`Movimientos: ${historial?.producto.nombre}`} onClose={() => setHistorial(null)} size="lg">
        {historial && !historial.items ? <Spinner /> : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Usuario</th></tr>
              </thead>
              <tbody>
                {historial?.items.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Sin movimientos registrados</td></tr>
                ) : historial?.items.map(m => (
                  <tr key={m.id}>
                    <td>{fechaHora(m.fecha)}</td>
                    <td><span className={`badge ${m.tipo === 'ENTRADA' ? 'bg-green' : m.tipo === 'SALIDA' ? 'bg-red' : 'bg-yellow'}`}>{m.tipo}</span></td>
                    <td className="td-bold">{m.tipo === 'SALIDA' ? `-${m.cantidad}` : m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</td>
                    <td>{m.motivo}</td>
                    <td>{m.usuario?.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
