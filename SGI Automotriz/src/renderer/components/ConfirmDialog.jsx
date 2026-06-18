import Modal from './Modal';
import Button from './Button';
export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, variant = 'danger' }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} size="sm">
      <p className="text-gray-600 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant={variant} onClick={onConfirm}>Confirmar</Button>
      </div>
    </Modal>
  );
}
