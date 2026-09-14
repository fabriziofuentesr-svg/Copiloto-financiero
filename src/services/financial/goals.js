// Cálculos de objetivos financieros (metas de ahorro) y su simulador.
export function goalProgress(goal) {
  const restante = Math.max(0, goal.target - goal.current);
  const progresoPct = goal.target > 0 ? Math.min(1, goal.current / goal.target) : 0;
  return { restante, progresoPct };
}

// Dado un aporte mensual, calcula en cuántos meses se alcanza la meta y la
// fecha estimada. Es la función que usa tanto la tarjeta de la meta como
// el simulador ("¿qué pasa si ahorro Bs X al mes?").
export function estimateGoalCompletion(goal, monthlyContribution = goal.monthlyContribution) {
  const { restante } = goalProgress(goal);
  if (restante === 0) {
    return { months: 0, date: new Date() };
  }
  const contribution = Number(monthlyContribution);
  if (!Number.isFinite(contribution) || contribution <= 0) {
    return { months: null, date: null };
  }
  const months = Math.ceil(restante / contribution);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return { months, date };
}
