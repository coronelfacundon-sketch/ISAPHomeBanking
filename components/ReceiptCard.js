import { currency } from '../utils/money';

export default function ReceiptCard({ origin, dest, tx, when }) {
  return (
    <div className="print-card bg-slate-800 text-white rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Comprobante #{tx}</h3>
        <span className="text-sm opacity-80">{new Date(when).toLocaleString()}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="opacity-80 mb-1">Origen</div>
          <div><b>{origin.company}</b></div>
          <div>Alias: {origin.alias}</div>
          <div>CBU: {origin.cbu}</div>
          <div>Saldo luego: {currency(origin.balance_after)}</div>
        </div>
        <div>
          <div className="opacity-80 mb-1">Destino</div>
          <div><b>{dest.company}</b></div>
          <div>Alias: {dest.alias}</div>
          <div>CBU: {dest.cbu}</div>
          <div>Saldo luego: {currency(dest.balance_after)}</div>
        </div>
      </div>
    </div>
  );
}
