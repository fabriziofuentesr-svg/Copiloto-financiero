// Datos ficticios de "Nicolás", usuario semilla del prototipo.
// Los importes clave (ingreso 4.000, gastos ~2.150, deuda 1.200/mes,
// ahorro capacidad ~650, ahorro actual 4.500, objetivo 20.000) son los
// que definiste en la sección 3 del brief; se usan como fuente única de
// verdad y todo lo demás (cuentas, próximos compromisos, transacciones)
// se construyó para ser consistente con ellos en vez de copiar también
// los ejemplos sueltos de otras secciones, que entre sí no cuadraban.
//
// Las fechas de las transacciones se generan de forma relativa a "hoy"
// para que la comparación mes actual / mes anterior siempre tenga sentido
// sin importar cuándo se abra la app.

import { addDays } from "../services/financial/format.js";

export const CATEGORIES = [
  { id: "vivienda", name: "Vivienda", type: "gasto", essential: true, color: "#1F5C56" },
  { id: "alimentacion", name: "Alimentación", type: "gasto", essential: true, color: "#C1892E" },
  { id: "transporte", name: "Transporte", type: "gasto", essential: true, color: "#5C8A72" },
  { id: "servicios", name: "Servicios", type: "gasto", essential: true, color: "#7A6A53" },
  { id: "salud", name: "Salud", type: "gasto", essential: true, color: "#A63D2C" },
  { id: "educacion", name: "Educación", type: "gasto", essential: false, color: "#8C6BAE" },
  { id: "entretenimiento", name: "Entretenimiento", type: "gasto", essential: false, color: "#D08C3E" },
  { id: "compras", name: "Compras", type: "gasto", essential: false, color: "#B85C7A" },
  { id: "deudas", name: "Deudas", type: "gasto", essential: true, color: "#6B4A3A" },
  { id: "ahorro", name: "Ahorro", type: "ahorro", essential: false, color: "#1F5C56" },
  { id: "otros", name: "Otros", type: "gasto", essential: false, color: "#8A8A8A" },
  { id: "salario", name: "Salario", type: "ingreso", essential: false, color: "#1F5C56" },
  { id: "extra", name: "Ingreso extra", type: "ingreso", essential: false, color: "#3D7A72" },
];

export const PAYMENT_METHODS = [
  { id: "efectivo", name: "Efectivo" },
  { id: "transferencia", name: "Transferencia" },
  { id: "qr", name: "QR" },
  { id: "tarjeta_debito", name: "Tarjeta de débito" },
  { id: "tarjeta_credito", name: "Tarjeta de crédito" },
];

export const ACCOUNT_TYPES = [
  { id: "banco", name: "Banco" },
  { id: "efectivo", name: "Efectivo" },
  { id: "ahorro", name: "Cuenta de ahorro" },
  { id: "tarjeta_credito", name: "Tarjeta de crédito" },
  { id: "billetera_digital", name: "Billetera digital" },
];

export const ACCOUNTS = [
  { id: "acc-banco", name: "Banco", type: "banco", balance: 3000, currency: "BOB" },
  { id: "acc-efectivo", name: "Efectivo", type: "efectivo", balance: 500, currency: "BOB" },
  { id: "acc-ahorro", name: "Cuenta de ahorro", type: "ahorro", balance: 4500, currency: "BOB" },
  { id: "acc-tc", name: "Tarjeta de crédito", type: "tarjeta_credito", balance: -1200, currency: "BOB" },
];

export const DEBTS = [
  {
    id: "debt-credito-personal",
    name: "Crédito personal",
    entity: "Banco Nacional",
    type: "prestamo_bancario",
    principal: 12000,
    balance: 9000,
    rate: 24,
    installment: 750,
    frequency: "mensual",
    paymentDay: 15,
    termMonths: 24,
    remainingInstallments: 12,
  },
  {
    id: "debt-tarjeta",
    name: "Tarjeta de crédito",
    entity: "Banco Unión",
    type: "tarjeta_credito",
    principal: 1200,
    balance: 1200,
    rate: 55,
    installment: 450,
    frequency: "mensual",
    paymentDay: 25,
    termMonths: null,
    remainingInstallments: null,
  },
];

// Gastos fijos recurrentes (no son deuda, pero sí comprometen el dinero disponible)
export const RECURRING_EXPENSES = [
  { id: "rec-alquiler", name: "Alquiler", category: "vivienda", amount: 1200, dayOfMonth: 10 },
  { id: "rec-servicios", name: "Servicios (luz, agua, internet)", category: "servicios", amount: 300, dayOfMonth: 20 },
];

export const GOALS = [
  {
    id: "goal-principal",
    name: "Meta de ahorro",
    target: 20000,
    current: 4500,
    monthlyContribution: 650,
    createdAt: addDays(new Date(), -60).toISOString(),
  },
];

export const EMERGENCY_FUND = {
  current: 1400,
  monthsTarget: 3,
};

export const DEMO_PROFILE = {
  name: "Nicolás",
  currency: "BOB",
  employmentType: "dependiente",
  estimatedMonthlyIncome: 4000,
  incomeDay: 30,
  onboardingCompleted: true,
};

// Perfil inicial de un usuario que todavía no configuró nada.
export function buildEmptyProfile() {
  return {
    name: "",
    currency: "BOB",
    employmentType: "",
    estimatedMonthlyIncome: 0,
    incomeDay: null,
    onboardingCompleted: false,
  };
}

// Estado con el que arranca cualquier usuario nuevo: sin cuentas, sin
// movimientos, sin deudas ni objetivos. Las categorías y métodos de pago
// son configuración de referencia (no datos inventados del usuario), así
// que sí vienen precargados.
export function buildEmptyState() {
  return {
    profile: buildEmptyProfile(),
    accounts: [],
    transactions: [],
    categories: CATEGORIES,
    paymentMethods: PAYMENT_METHODS,
    goals: [],
    debts: [],
    recurringExpenses: [],
    emergencyFund: { current: 0, monthsTarget: 3 },
  };
}

// Estado de demostración (datos ficticios de "Nicolás"), solo para que
// alguien pueda explorar la app sin cargar sus propios datos. Nunca se
// carga automáticamente: hay que pedirlo explícitamente desde Configuración.
export function buildDemoState() {
  return {
    profile: DEMO_PROFILE,
    accounts: ACCOUNTS,
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    paymentMethods: PAYMENT_METHODS,
    goals: GOALS,
    debts: DEBTS,
    recurringExpenses: RECURRING_EXPENSES,
    emergencyFund: EMERGENCY_FUND,
  };
}

// --- Transacciones ---------------------------------------------------------
// Generadas en relación a "hoy" para que "este mes" / "mes pasado" siempre
// tenga sentido. Los montos de alimentación/transporte/entretenimiento del
// mes anterior están calculados para que las variaciones sean exactamente
// +25%, -8% y +31% frente al mes actual (el mismo patrón de ejemplo que
// planteaste en la sección 17), y así los insights se sientan reales.
function generateTransactions() {
  const today = new Date();
  const day = (offset) => addDays(today, offset).toISOString();
  const tx = [];
  let id = 1;
  const push = (t) => tx.push({ id: `tx-${id++}`, ...t });

  // Ingreso del mes actual
  push({ description: "Salario", amount: 4000, date: day(-5), category: "salario", accountId: "acc-banco", paymentMethod: "transferencia", type: "ingreso" });
  // Ingreso del mes anterior (para comparación)
  push({ description: "Salario", amount: 4000, date: day(-35), category: "salario", accountId: "acc-banco", paymentMethod: "transferencia", type: "ingreso" });

  // Gastos fijos ya registrados este mes
  push({ description: "Alquiler", amount: 1200, date: day(-8), category: "vivienda", accountId: "acc-banco", paymentMethod: "transferencia", type: "gasto" });
  push({ description: "Servicios (luz, agua, internet)", amount: 300, date: day(-3), category: "servicios", accountId: "acc-banco", paymentMethod: "qr", type: "gasto" });
  push({ description: "Alquiler", amount: 1200, date: day(-38), category: "vivienda", accountId: "acc-banco", paymentMethod: "transferencia", type: "gasto" });
  push({ description: "Servicios (luz, agua, internet)", amount: 300, date: day(-33), category: "servicios", accountId: "acc-banco", paymentMethod: "qr", type: "gasto" });

  // Alimentación — mes actual = Bs 400, mes anterior = Bs 320 (+25%)
  push({ description: "Supermercado", amount: 180, date: day(-6), category: "alimentacion", accountId: "acc-efectivo", paymentMethod: "efectivo", type: "gasto" });
  push({ description: "Mercado", amount: 120, date: day(-2), category: "alimentacion", accountId: "acc-efectivo", paymentMethod: "efectivo", type: "gasto" });
  push({ description: "Restaurante", amount: 100, date: day(-1), category: "alimentacion", accountId: "acc-tc", paymentMethod: "tarjeta_credito", type: "gasto" });
  push({ description: "Supermercado", amount: 150, date: day(-30), category: "alimentacion", accountId: "acc-efectivo", paymentMethod: "efectivo", type: "gasto" });
  push({ description: "Mercado", amount: 100, date: day(-25), category: "alimentacion", accountId: "acc-efectivo", paymentMethod: "efectivo", type: "gasto" });
  push({ description: "Restaurante", amount: 70, date: day(-20), category: "alimentacion", accountId: "acc-tc", paymentMethod: "tarjeta_credito", type: "gasto" });

  // Transporte — mes actual = Bs 150, mes anterior = Bs 163 (-8%)
  push({ description: "Taxi", amount: 25, date: day(-7), category: "transporte", accountId: "acc-efectivo", paymentMethod: "efectivo", type: "gasto" });
  push({ description: "Transporte público", amount: 65, date: day(-4), category: "transporte", accountId: "acc-efectivo", paymentMethod: "efectivo", type: "gasto" });
  push({ description: "Taxi", amount: 60, date: day(-2), category: "transporte", accountId: "acc-efectivo", paymentMethod: "efectivo", type: "gasto" });
  push({ description: "Transporte público", amount: 83, date: day(-28), category: "transporte", accountId: "acc-efectivo", paymentMethod: "efectivo", type: "gasto" });
  push({ description: "Taxi", amount: 80, date: day(-22), category: "transporte", accountId: "acc-efectivo", paymentMethod: "efectivo", type: "gasto" });

  // Entretenimiento — mes actual = Bs 100, mes anterior = Bs 76 (+31%)
  push({ description: "Cine", amount: 40, date: day(-9), category: "entretenimiento", accountId: "acc-tc", paymentMethod: "tarjeta_credito", type: "gasto" });
  push({ description: "Streaming", amount: 60, date: day(-3), category: "entretenimiento", accountId: "acc-banco", paymentMethod: "transferencia", type: "gasto" });
  push({ description: "Streaming", amount: 76, date: day(-31), category: "entretenimiento", accountId: "acc-banco", paymentMethod: "transferencia", type: "gasto" });

  return tx.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export const TRANSACTIONS = generateTransactions();
