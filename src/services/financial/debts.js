// Cálculos relacionados a deudas. La amortización detallada (tabla mes a
// mes con capital/interés) queda para la siguiente iteración; por ahora
// resolvemos el simulador con una aproximación de interés simple mensual,
// que ya permite comparar escenarios de forma razonable.
export function monthlyRate(annualRatePct) {
  return annualRatePct / 100 / 12;
}

export function estimatePayoff(debt, extraMonthly = 0) {
  const rate = monthlyRate(debt.rate);
  const payment = debt.installment + extraMonthly;
  let balance = debt.balance;
  let months = 0;
  let totalInterest = 0;

  if (payment <= balance * rate) {
    // La cuota no alcanza a cubrir el interés: nunca se termina de pagar.
    return { months: Infinity, totalInterest: Infinity, finalDate: null };
  }

  while (balance > 0 && months < 600) {
    const interest = balance * rate;
    totalInterest += interest;
    balance = balance + interest - payment;
    months += 1;
  }

  const finalDate = new Date();
  finalDate.setMonth(finalDate.getMonth() + months);
  return { months, totalInterest: Math.round(totalInterest), finalDate };
}

export function compareExtraPayment(debt, extraMonthly) {
  const base = estimatePayoff(debt, 0);
  const withExtra = estimatePayoff(debt, extraMonthly);
  const monthsSaved = base.months === Infinity || withExtra.months === Infinity ? null : base.months - withExtra.months;
  const interestSaved = base.totalInterest === Infinity || withExtra.totalInterest === Infinity ? null : base.totalInterest - withExtra.totalInterest;
  return { base, withExtra, monthsSaved, interestSaved };
}

export function totalMonthlyInstallments(debts) {
  return debts.reduce((s, d) => s + d.installment, 0);
}

