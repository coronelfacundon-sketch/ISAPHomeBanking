export const toCents = (value) => {
  if (typeof value === 'number') return Math.round(value * 100);
  const s = String(value ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const currency = (cents) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format((cents || 0) / 100);
