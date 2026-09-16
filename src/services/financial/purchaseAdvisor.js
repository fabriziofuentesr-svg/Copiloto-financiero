import { calculateAvailableMoney, getDataQuality, getEmergencyFundStatus, getTotalDebtBalance, projectCashFlow } from "./calculations.js";
import { monthlyPlanStatus, monthlyHealth, monthKey } from "./monthlyPlan.js";

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function evaluatePurchase(state, amount, referenceDate = new Date()) {
  const price = round(amount);
  if (!(price > 0)) return { verdict: "incomplete", label: "Indica un monto válido", explanation: "Escribe un precio mayor a cero.", missing: ["precio de la compra"] };
  const month=monthlyPlanStatus(state,monthKey(referenceDate),referenceDate);
  if(month.plan) {
    const health=monthlyHealth(state,month.month,referenceDate);
    const reserveSource=state.accounts.find(account=>account.id === month.plan.emergency.sourceId);
    const separatelyProtected=month.plan.emergency.sourceType === "goal" || reserveSource?.type === "ahorro";
    const reserveAfter=separatelyProtected ? health.reserve : Math.max(0,health.reserve-price);
    const reserveTarget=round(health.essentialMonthly*Math.max(1,state.emergencyFund?.monthsTarget || 3));
    const projectedAfter=round(month.closing-price);
    const missing=[...health.missing,...(!health.essentialMonthly ? ["gastos esenciales estimados"] : []),...(!month.plan.recordsComplete ? ["movimientos completos desde el inicio del mes"] : []),...(getDataQuality(state,referenceDate).level === "insuficiente" ? ["al menos un ingreso y un gasto reales"] : [])];
    const common={price,availableBefore:month.availableToday,availableAfter:round(month.availableToday-price),totalAssetsBefore:month.cash.total,assetsAfter:round(month.cash.total-price),commitments:round(month.fixedPending+month.debtPending+month.overduePending),commitmentsCovered:month.availableToday>=price,reserveBefore:health.reserve,reserveAfter,reserveTarget,reserveMonthsAfter:health.essentialMonthly>0 ? reserveAfter/health.essentialMonthly : null,goalDelayed:projectedAfter<month.target ? "Objetivo de cierre del mes" : null,projectedAfter,debtBalance:getTotalDebtBalance(state),dataQuality:month.confidence,missing:[...new Set(missing)],assumptions:["Compra adicional no incluida en las estimaciones del Plan del mes","Cuentas de ahorro y aportes protegidos se excluyen una sola vez",`Reserva de referencia: ${state.emergencyFund?.monthsTarget || 3} meses de gastos esenciales`,separatelyProtected ? "La reserva está separada del disponible de uso diario" : "Por prudencia, la compra podría consumir el ahorro declarado en una cuenta de uso diario"]};
    if(!common.commitmentsCovered || projectedAfter<0) return {...common,verdict:"no",label:"No recomendable",explanation:"La compra supera el disponible después de compromisos o deja el cierre del mes en negativo."};
    if(missing.length) return {...common,verdict:"incomplete",label:"Evaluación incompleta",explanation:"Faltan datos para confirmar la cobertura del mes y los imprevistos."};
    if(reserveAfter<reserveTarget || projectedAfter<month.target) return {...common,verdict:"precaucion",label:"Conviene esperar",explanation:"La reserva queda por debajo de su referencia o te alejas del objetivo de cierre. Revisa el Plan del mes antes de comprar."};
    return {...common,verdict:"si",label:"Recomendable",explanation:"El plan conserva cobertura para compromisos, gastos variables, aportes y reserva; la compra deja cubierto el objetivo de cierre."};
  }

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
