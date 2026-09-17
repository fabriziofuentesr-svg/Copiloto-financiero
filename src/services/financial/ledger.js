import { profileToday } from "./movementDates.js";
import { localDateString } from "./format.js";

export const NON_OPERATING_ORIGINS = new Set([
  "initial_balance",
  "balance_adjustment",
  "internal_transfer",
  "migration_balance",
]);

export function isCreditCard(account) {
  return account?.type === "tarjeta_credito";
}

export function isAssetAccount(account) {
  return Boolean(account) && !isCreditCard(account);
}

export function isOperatingTransaction(transaction) {
  return (transaction?.type === "ingreso" || transaction?.type === "gasto")
    && !NON_OPERATING_ORIGINS.has(transaction.origin);
}

export function isRealUserTransaction(transaction) {
  return isOperatingTransaction(transaction) && !transaction.generated && (transaction.origin || "user") === "user";
}

export function getTransactionBalanceDelta(transaction) {
  if (Number.isFinite(Number(transaction?.balanceDelta))) return Number(transaction.balanceDelta);
  const amount = Number(transaction?.amount) || 0;
  if (transaction?.type === "ingreso") return amount;
  if (transaction?.type === "gasto") return -amount;
  return 0;
}

export function buildAccountCreation(payload, createId, createdAt = new Date()) {
  const enteredBalance = Math.max(0, Number(payload.balance) || 0);
  const accountId = payload.id || createId("acc");
  const creditCard = payload.type === "tarjeta_credito";
  const account = {
    id: accountId,
    name: String(payload.name || "").trim(),
    type: payload.type || "efectivo",
    balance: creditCard ? -enteredBalance : enteredBalance,
    currency: payload.currency || "BOB",
    createdAt: payload.createdAt || new Date(createdAt).toISOString(),
    creditLimit: creditCard && payload.creditLimit !== "" ? Number(payload.creditLimit) || null : null,
    statementDay: creditCard && payload.statementDay !== "" ? Number(payload.statementDay) || null : null,
    paymentDay: creditCard && payload.paymentDay !== "" ? Number(payload.paymentDay) || null : null,
    minimumPayment: creditCard && payload.minimumPayment !== "" ? Number(payload.minimumPayment) || null : null,
    rate: creditCard && payload.rate !== "" ? Number(payload.rate) || null : null,
  };

  // El saldo inicial explica el punto de partida del libro, pero se excluye
  // expresamente de ingresos operativos, ahorro y proyecciones futuras.
  const openingTransaction = !creditCard && enteredBalance > 0 ? {
    id: `${accountId}-initial-balance`,
    type: "ingreso",
    description: `Saldo inicial — ${account.name}`,
    amount: enteredBalance,
    date: localDateString(createdAt),
    category: "saldo_inicial",
    accountId,
    linkedAccountId: accountId,
    paymentMethod: "transferencia",
    origin: "initial_balance",
    generated: true,
    createdAt: new Date(createdAt).toISOString(),
  } : null;

  return { account, openingTransaction };
}

export function buildTransfer(payload, accounts, createId, createdAt = new Date()) {
  const amount = Math.round((Number(payload.amount) || 0) * 100) / 100;
  const source = accounts.find((account) => account.id === payload.fromAccountId && isAssetAccount(account));
  const destination = accounts.find((account) => account.id === payload.toAccountId && isAssetAccount(account));
  if (!(amount > 0) || !source || !destination || source.id === destination.id || Number(source.balance) < amount) return null;
  const transferGroupId = payload.transferGroupId || createId("transfer");
  const date = payload.date || localDateString(createdAt);
  const description = String(payload.description || "").trim() || `Transferencia — ${source.name} a ${destination.name}`;
  const common = { type: "transferencia", amount, date, category: "transferencia", origin: "internal_transfer", generated: true, transferGroupId };
  return {
    source,
    destination,
    amount,
    outgoing: { id: createId("tx"), ...common, description, accountId: source.id, linkedAccountId: source.id, balanceDelta: -amount },
    incoming: { id: createId("tx"), ...common, description, accountId: destination.id, linkedAccountId: destination.id, balanceDelta: amount },
  };
}

export function getRealMovementProgress(state) {
  const real = (state.transactions || []).filter(tx=>isRealUserTransaction(tx) && tx.date <= profileToday(state.profile));
  const hasIncome = real.some((transaction) => transaction.type === "ingreso");
  const hasExpense = real.some((transaction) => transaction.type === "gasto");
  return {
    hasIncome,
    hasExpense,
    complete: hasIncome && hasExpense,
    count: real.length,
  };
}
