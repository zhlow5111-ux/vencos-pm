export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

let _idCounter = 0;
export function generateId(): number {
  _idCounter = (_idCounter + 1) % 1000;
  return Date.now() * 1000 + _idCounter + Math.floor(Math.random() * 100);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function calculateEstimatedBalance(loanAmount: number, monthlyPayment: number, annualRate: number, loanStart: string): { estimatedBalance: number; monthsElapsed: number } | null {
  if (!loanAmount || !monthlyPayment || !annualRate || !loanStart) return null;
  const start = new Date(loanStart);
  const now = new Date();
  if (start >= now) return null;

  const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (monthsElapsed <= 0) return null;

  let balance = loanAmount;
  const monthlyRate = annualRate / 12 / 100;

  for (let i = 0; i < monthsElapsed; i++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    if (principal <= 0) break; // Payment doesn't cover interest
    balance -= principal;
    if (balance <= 0) { balance = 0; break; }
  }

  return { estimatedBalance: Math.round(balance * 100) / 100, monthsElapsed };
}
