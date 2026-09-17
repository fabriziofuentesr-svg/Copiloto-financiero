import { profileToday } from "./movementDates.js";
import { isOperatingTransaction, getTransactionBalanceDelta } from "./ledger.js";
import { money, spendingMoney } from "./monthlyPlan.js";

export function actualMonth(state, month = profileToday(state.profile).slice(0, 7), now = new Date()) {
  const today = profileToday(state.profile, now);
  const future = (state.transactions || []).filter(tx => tx.date > today);
  const accounts = state.accounts.map(account => ({ ...account, balance: money(account.balance - future.filter(tx => tx.accountId === account.id).reduce((sum, tx) => sum + getTransactionBalanceDelta(tx), 0)) }));
  const cash = spendingMoney({ ...state, accounts });
  const transactions = (state.transactions || []).filter(tx => tx.date <= today && tx.date.slice(0, 7) === month && isOperatingTransaction(tx));
  const income = money(transactions.filter(tx => tx.type === "ingreso").reduce((sum, tx) => sum + tx.amount, 0));
  const expenses = transactions.filter(tx => tx.type === "gasto");
  const expense = money(expenses.reduce((sum, tx) => sum + tx.amount, 0));
  const categories = new Map();
  const classification = { fijo: 0, variable: 0, sinClasificar: 0 };
  for (const tx of expenses) {
    const category = tx.categorySnapshot || state.categories.find(item => item.id === tx.category);
    const item = categories.get(tx.category) || { id: tx.category, name: category?.name || "Sin categoría", amount: 0 };
    item.amount = money(item.amount + tx.amount);
    categories.set(tx.category, item);
    const key = ["fijo", "variable"].includes(category?.classification) ? category.classification : "sinClasificar";
    classification[key] = money(classification[key] + tx.amount);
  }
  const [year, number] = month.split("-").map(Number);
  const days = new Date(year, number, 0).getDate();
  const weeks = [];
  for (let start = 1; start <= days; start += 7) {
    const end = Math.min(start + 6, days);
    const selected = transactions.filter(tx => Number(tx.date.slice(8)) >= start && Number(tx.date.slice(8)) <= end);
    weeks.push({ name: `${start}–${end}`, income: money(selected.filter(tx => tx.type === "ingreso").reduce((sum, tx) => sum + tx.amount, 0)), expense: money(selected.filter(tx => tx.type === "gasto").reduce((sum, tx) => sum + tx.amount, 0)) });
  }
  return { today, month, accounts, cash, transactions, income, expense, result: money(income - expense), categories: [...categories.values()].sort((a, b) => b.amount - a.amount).map(item => ({ ...item, percent: expense > 0 ? item.amount / expense * 100 : 0 })), classification, weeks, futureCount: future.length };
}

// Estimates, closing targets and expected contributions never improve this score.
export function actualFinancialHealth(state, month, now = new Date()) {
  const facts = actualMonth(state, month, now);
  const cards = state.accounts.filter(account => account.type === "tarjeta_credito" && account.balance < 0);
  const debts = state.debts.filter(debt => debt.balance > 0 && !cards.some(card => card.id === debt.linkedAccountId || card.name.toLowerCase() === debt.name.toLowerCase()));
  const obligations = [...cards.map(card => card.minimumPayment), ...debts.map(debt => debt.installment)];
  const knownDebt = obligations.every(value => value !== null && value !== undefined);
  const payments = money(obligations.reduce((sum, value) => sum + Number(value || 0), 0));
  const essential = money(facts.transactions.filter(tx => tx.type === "gasto" && state.categories.find(category => category.id === tx.category)?.essential).reduce((sum, tx) => sum + tx.amount, 0));
  const bounded = value => Math.round(Math.max(0, Math.min(100, value)));
  const reserve = money(facts.cash.savings + facts.cash.protectedMoney);
  const breakdown = {
    flujoCaja: { weight: .35, score: facts.income > 0 ? bounded(50 + facts.result / facts.income * 100) : null, reason: `Ingresos registrados ${facts.income}; gastos registrados ${facts.expense}.`, action: "Registra tus ingresos y gastos reales." },
    reserva: { weight: .25, score: essential > 0 ? bounded(reserve / (essential * (state.emergencyFund?.monthsTarget || 3)) * 100) : null, reason: `Ahorro respaldado ${reserve}; gastos esenciales registrados ${essential}.`, action: "Clasifica y registra tus gastos esenciales; conserva una reserva." },
    endeudamiento: { weight: .25, score: knownDebt && facts.income > 0 ? bounded(100 - payments / facts.income * 150) : null, reason: `Cuotas y pagos mínimos ${payments}.`, action: "Completa los pagos mínimos de tarjetas y registra cada pago." },
    planificacion: { weight: .15, score: facts.transactions.length >= 4 ? bounded(Math.min(1, (state.savingsAllocations || []).reduce((sum, item) => sum + item.amount, 0) / Math.max(1, reserve)) * 100) : null, reason: "Se considera ahorro vinculado a cuentas y registros suficientes, no estimaciones.", action: "Vincula tus ahorros existentes y mantén tus registros al día." },
  };
  const present = Object.values(breakdown).filter(item => item.score !== null);
  const missing = Object.entries(breakdown).filter(([, item]) => item.score === null).map(([key]) => key);
  return { available: present.length > 0, missing, breakdown, partial: missing.length > 0, scoreDisplayable: missing.length === 0 && facts.transactions.length >= 4, score: present.length ? Math.round(present.reduce((sum, item) => sum + item.score * item.weight, 0) / present.reduce((sum, item) => sum + item.weight, 0) / 5) * 5 : null, confidence: missing.length || facts.transactions.length < 4 ? "baja" : "media", resumen: "Basado en tus movimientos registrados y ahorros respaldados. Los datos parciales no representan todo el mes." };
}
