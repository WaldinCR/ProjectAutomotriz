import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import Button     from '../components/Button';
import Input      from '../components/Input';
import Modal      from '../components/Modal';
import Table      from '../components/Table';
import Alert      from '../components/Alert';
import Spinner    from '../components/Spinner';
import { listarProductos, crearProducto, registrarEntrada } from '../services/inventoryService';

const EMPTY = { nombre:'', codigoBarras:'', categoria:'', precioCompra:'', precioVenta:'', stock:'', stockMinimo:'5' };

export default function InventoryPage() {
  const [productos, setProductos] = useState([]);
  const [filtro, setFiltro]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [alerta, setAlerta]       = useState(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [entrada, setEntrada]     = useState({ cantidad: '', motivo: '' });

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try { setProductos(await listarProductos()); }
    catch { setAlerta({ type: 'error', msg: 'Error al cargar productos' }); }
    finally { setLoading(false); }
  }

  async function handleCrear() {
    try {
      await crearProducto({
        ...form,
        precioCompra: parseFloat(form.precioCompra), precioVenta: parseFloat(form.precioVenta),
        stock: parseInt(form.stock), stockMinimo: parseInt(form.stockMinimo),
      });
      setAlerta({ type: 'success', msg: 'Producto creado' });
      setModalNuevo(false); setForm(EMPTY); cargar();
    } catch (e) { setAlerta({ type: 'error', msg: e.message }); }
  }

  async function handleEntrada() {
    try {
      await registrarEntrada({ productoId: modalEntrada.id, ...entrada, cantidad: parseInt(entrada.cantidad) });
      setAlerta({ type: 'success', msg: 'Entrada registrada' });
      setModalEntrada(null); setEntrada({ cantidad:'', motivo:'' }); cargar();
    } catch (e) { setAlerta({ type: 'error', msg: e.message }); }
  }

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    (p.codigoBarras||'').includes(filtro) || p.codigoInterno.includes(filtro)
  );

  const rows = filtrados.map(p => [
    p.codigoInterno, p.codigoBarras||'—', p.nombre, p.categoria,
    `RD$ ${p.precioVenta.toFixed(2)}`,
    <span className={p.stock<=p.stockMinimo?'text-red-600 font-bold':'text-green-700 font-semibold'}>
      {p.stock} {p.stock<=p.stockMinimo?'⚠️':''}
    </span>,
    <Button size="sm" variant="ghost" onClick={() => setModalEntrada(p)}>+ Entrada</Button>
  ]);

  return (
    <PageLayout title="📦 Inventario" actions={<Button onClick={() => setModalNuevo(true)}>+ Nuevo Producto</Button>}>
      {alerta && <Alert type={alerta.type} message={alerta.msg} onClose={() => setAlerta(null)} />}
      <Input placeholder="Buscar por nombre, código..." value={filtro}
        onChange={e => setFiltro(e.target.value)} className="mb-4 max-w-md" />
      {loading ? <Spinner /> : (
        <Table headers={['Cód. Interno','Cód. Barras','Nombre','Categoría','Precio','Stock','']} rows={rows} />
      )}
      <Modal open={modalNuevo} title="Nuevo Producto" onClose={() => setModalNuevo(false)} size="lg">
        <div className="grid grid-cols-2 gap-4">
          {[['nombre','Nombre','text'],['codigoBarras','Código de Barras (opcional)','text'],
            ['categoria','Categoría','text'],['precioCompra','Precio Compra','number'],
            ['precioVenta','Precio Venta','number'],['stock','Stock Inicial','number'],
            ['stockMinimo','Stock Mínimo','number']].map(([k,l,t]) => (
            <Input key={k} label={l} type={t} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} />
          ))}
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="ghost" onClick={() => setModalNuevo(false)}>Cancelar</Button>
          <Button onClick={handleCrear}>Guardar</Button>
        </div>
      </Modal>
      <Modal open={!!modalEntrada} title={`Entrada: ${modalEntrada?.nombre}`} onClose={() => setModalEntrada(null)} size="sm">
        <Input label="Cantidad" type="number" value={entrada.cantidad}
          onChange={e => setEntrada({...entrada, cantidad:e.target.value})} className="mb-3" />
        <Input label="Motivo" value={entrada.motivo}
          onChange={e => setEntrada({...entrada, motivo:e.target.value})} className="mb-6" />
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setModalEntrada(null)}>Cancelar</Button>
          <Button variant="success" onClick={handleEntrada}>Registrar</Button>
        </div>
      </Modal>
    </PageLayout>
  );
}
