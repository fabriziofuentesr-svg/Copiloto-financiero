// Cálculos de objetivos financieros (metas de ahorro) y su simulador.
export function goalProgress(goal) {
  const restante = Math.max(0, goal.target - Number(goal.current) - Number(goal.used || 0));
  const progresoPct = goal.target > 0 ? Math.min(1, (Number(goal.current) + Number(goal.used || 0)) / goal.target) : 0;
  return { restante, progresoPct };
}

// Dado un aporte mensual, calcula en cuántos meses se alcanza la meta y la
// fecha estimada. Es la función que usa tanto la tarjeta de la meta como
// el simulador ("¿qué pasa si ahorro Bs X al mes?").
export function estimateGoalCompletion(goal, monthlyContribution = goal.monthlyContribution, now = new Date()) {
  const { restante } = goalProgress(goal);
  if (restante === 0) {
    return { months: 0, date: new Date() };
  }
  const contribution = Number(monthlyContribution);
  if (!Number.isFinite(contribution) || contribution <= 0) {
    return { months: null, date: null };
  }
  const months = Math.ceil(restante / contribution);
  const frequency = goal.contributionFrequency || "mensual";
  const date = new Date(now);
  if (frequency === "semanal") date.setDate(date.getDate() + months * 7);
  else {
    const anchor = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    date.setDate(Math.min(anchor, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  }
  return { months: frequency === "mensual" ? months : null, periods: months, frequency, date };
}
