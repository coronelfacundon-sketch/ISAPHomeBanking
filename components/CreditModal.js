import { useState } from 'react';
import { toCents } from '../utils/money';

export default function CreditModal({ open, onClose, onConfirm, account }) {
  const [amount, setAmount] = useState('');
  if (!open) return null;

  const submit = () => {
    const cents = toCents(amount);
    if (cents <= 0) return alert('Importe inválido');
    onConfirm(cents);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-white rounded-xl p-6">
        <h3 className="text-xl font-semibold mb-2">Acreditar a {account?.alias}</h3>
        <p className="text-sm text-gray-600 mb-4">{account?.company_name}</p>
        <label className="block text-sm font-medium mb-1">Importe (ARS)</label>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="ej: 5.000,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded border">Cancelar</button>
          <button onClick={submit} className="px-3 py-2 rounded bg-emerald-700 text-white">Acreditar</button>
        </div>
      </div>
    </div>
  );
}
