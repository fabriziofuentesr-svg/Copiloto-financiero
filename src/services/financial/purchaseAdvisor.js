import { calculateAvailableMoney, getDataQuality, getEmergencyFundStatus, getTotalDebtBalance, projectCashFlow } from "./calculations.js";

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function evaluatePurchase(state, amount, referenceDate = new Date()) {
  const price = round(amount);
  if (!(price > 0)) return { verdict: "incomplete", label: "Indica un monto válido", explanation: "Escribe un precio mayor a cero.", missing: ["precio de la compra"] };

  const cash = calculateAvailableMoney(state, referenceDate);
  const emergency = getEmergencyFundStatus(state, referenceDate);
  const projection = projectCashFlow(state, { mode: "rolling_30", referenceDate });
  const dataQuality = getDataQuality(state, referenceDate);
  const settings = state.financialSettings || {};
  const incompleteCards = (state.accounts || []).filter((account) => account.type === "tarjeta_credito" && Number(account.balance) < 0 && (!(Number(account.minimumPayment) > 0) || !account.paymentDay));
  const missing = [];
  if (!(state.accounts || []).some((account) => account.type !== "tarjeta_credito")) missing.push("una cuenta de activo");
  if (!settings.essentialExpensesConfigured || !(emergency.essentialMonthly > 0)) missing.push("gastos esenciales");
  if (!state.emergencyFund?.configured) missing.push("objetivo y monto del fondo de emergencia");
  if (!(settings.debtStatus === "none" || settings.debtStatus === "has_debt")) missing.push("situación de deudas");
  if (incompleteCards.length) missing.push(`pago mínimo y fecha de ${incompleteCards.map((account) => account.name).join(", ")}`);
  if (!projection.available) missing.push(...projection.missing);
  if (dataQuality.level === "insuficiente") missing.push("al menos un ingreso y un gasto reales");

  const availableAfter = round(cash.available - price);
  const assetsAfter = round(cash.totalBalance - price);
  const reserveAfter = Math.max(0, Math.min(Number(state.emergencyFund?.current) || 0, availableAfter));
  const reserveTarget = emergency.target;
  const reserveMonthsAfter = emergency.essentialMonthly > 0 ? reserveAfter / emergency.essentialMonthly : null;
  const commitmentsCovered = availableAfter >= 0;
  const projectedAfter = projection.available ? round(projection.end - price) : null;
  const activeGoal = (state.goals || []).find((goal) => Number(goal.current) < Number(goal.target) && Number(goal.monthlyContribution) > 0);
  const goalDelayed = activeGoal && reserveAfter < reserveTarget ? activeGoal.name : null;
  const common = {
    price,
    availableBefore: cash.available,
    availableAfter,
    totalAssetsBefore: cash.totalBalance,
    assetsAfter,
    commitments: cash.committed,
    commitmentsCovered,
    reserveBefore: Number(state.emergencyFund?.current) || 0,
    reserveAfter,
    reserveTarget,
    reserveMonthsAfter,
    goalDelayed,
    projectedAfter,
    debtBalance: getTotalDebtBalance(state),
    dataQuality: dataQuality.level,
    assumptions: ["Compromisos de los próximos 30 días", "Aportes mensuales a metas activas", "Fondo de emergencia configurado"],
    missing: [...new Set(missing)],
  };

  if (price > cash.available || !commitmentsCovered) return { ...common, verdict: "no", label: "No recomendable", explanation: "La compra supera tu dinero disponible después de compromisos y dejaría pagos próximos sin cobertura." };
  if (projection.available && projectedAfter < 0) return { ...common, verdict: "no", label: "No recomendable", explanation: "Aunque puedes pagar hoy, la proyección de 30 días quedaría en negativo." };
  if (missing.length) return { ...common, verdict: "incomplete", label: "Evaluación incompleta", explanation: "La compra cabe en tu saldo, pero faltan datos para confirmar que sea segura." };

  if (reserveAfter < reserveTarget) {
    const severe = reserveAfter < reserveTarget * 0.5;
    return {
      ...common,
      verdict: severe ? "no" : "precaucion",
      label: severe ? "No recomendable" : "Conviene esperar",
      explanation: severe ? "La compra consumiría más de la mitad de la reserva mínima que necesitas conservar." : "La compra dejaría tu reserva por debajo del mínimo configurado.",
    };
  }

  return { ...common, verdict: "si", label: "Recomendable", explanation: "Después de la compra quedan cubiertos tus compromisos, reserva mínima y aportes prioritarios." };
}
