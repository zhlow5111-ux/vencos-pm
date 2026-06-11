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

export interface PrepaymentRecord {
  amount: number;
  payment_date: string;
}

export function calculateEstimatedBalance(loanAmount: number, monthlyPayment: number, annualRate: number, loanStart: string, prepayments?: PrepaymentRecord[]): { estimatedBalance: number; monthsElapsed: number } | null {
  if (!loanAmount || !monthlyPayment || !annualRate || !loanStart) return null;
  const start = new Date(loanStart);
  const now = new Date();
  if (start >= now) return null;

  const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (monthsElapsed <= 0) return null;

  let balance = loanAmount;
  const monthlyRate = annualRate / 12 / 100;

  // Build a map of prepayment amounts by month offset
  const prepaymentByMonth: Record<number, number> = {};
  if (prepayments) {
    for (const p of prepayments) {
      const pDate = new Date(p.payment_date);
      const monthOffset = (pDate.getFullYear() - start.getFullYear()) * 12 + (pDate.getMonth() - start.getMonth());
      if (monthOffset >= 0) {
        prepaymentByMonth[monthOffset] = (prepaymentByMonth[monthOffset] || 0) + p.amount;
      }
    }
  }

  for (let i = 0; i < monthsElapsed; i++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    if (principal <= 0) break;
    balance -= principal;
    // Apply any prepayments in this month
    if (prepaymentByMonth[i]) {
      balance -= prepaymentByMonth[i];
    }
    if (balance <= 0) { balance = 0; break; }
  }

  return { estimatedBalance: Math.round(balance * 100) / 100, monthsElapsed };
}

// Calculate loan projection with and without prepayments
export function calculateLoanProjection(
  loanAmount: number, monthlyPayment: number, annualRate: number, loanStart: string, prepayments: PrepaymentRecord[]
): {
  withoutPrepay: { totalMonths: number; totalInterest: number; payoffDate: string };
  withPrepay: { totalMonths: number; totalInterest: number; payoffDate: string };
  totalPrepaid: number;
  interestSaved: number;
  monthsSaved: number;
} | null {
  if (!loanAmount || !monthlyPayment || !annualRate || !loanStart) return null;
  const monthlyRate = annualRate / 12 / 100;
  const start = new Date(loanStart);
  const MAX_MONTHS = 600; // 50 years cap

  // Build prepayment map
  const prepaymentByMonth: Record<number, number> = {};
  let totalPrepaid = 0;
  for (const p of prepayments) {
    const pDate = new Date(p.payment_date);
    const monthOffset = (pDate.getFullYear() - start.getFullYear()) * 12 + (pDate.getMonth() - start.getMonth());
    if (monthOffset >= 0) {
      prepaymentByMonth[monthOffset] = (prepaymentByMonth[monthOffset] || 0) + p.amount;
      totalPrepaid += p.amount;
    }
  }

  // Simulate WITHOUT prepayments
  let bal1 = loanAmount;
  let totalInterest1 = 0;
  let months1 = 0;
  for (let i = 0; i < MAX_MONTHS && bal1 > 0; i++) {
    const interest = bal1 * monthlyRate;
    totalInterest1 += interest;
    const principal = monthlyPayment - interest;
    if (principal <= 0) break;
    bal1 -= principal;
    months1++;
    if (bal1 <= 0) { bal1 = 0; break; }
  }

  // Simulate WITH prepayments
  let bal2 = loanAmount;
  let totalInterest2 = 0;
  let months2 = 0;
  for (let i = 0; i < MAX_MONTHS && bal2 > 0; i++) {
    const interest = bal2 * monthlyRate;
    totalInterest2 += interest;
    const principal = monthlyPayment - interest;
    if (principal <= 0) break;
    bal2 -= principal;
    if (prepaymentByMonth[i]) bal2 -= prepaymentByMonth[i];
    months2++;
    if (bal2 <= 0) { bal2 = 0; break; }
  }

  const addMonths = (d: Date, m: number) => {
    const r = new Date(d);
    r.setMonth(r.getMonth() + m);
    return r.toISOString().slice(0, 7);
  };

  return {
    withoutPrepay: { totalMonths: months1, totalInterest: Math.round(totalInterest1), payoffDate: addMonths(start, months1) },
    withPrepay: { totalMonths: months2, totalInterest: Math.round(totalInterest2), payoffDate: addMonths(start, months2) },
    totalPrepaid,
    interestSaved: Math.round(totalInterest1 - totalInterest2),
    monthsSaved: months1 - months2,
  };
}
