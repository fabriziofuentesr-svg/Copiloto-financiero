# Copiloto Financiero — Bolivia

Prototipo de copiloto financiero personal. React + Vite + Tailwind + React Router + Recharts.

## Ejecutar en local

```bash
npm install
npm run dev
```

## Desplegar en Vercel (vía GitHub)

```bash
git init && git add . && git commit -m "Copiloto financiero: primera iteración modular"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

En https://vercel.com/new, importa el repo. Vercel detecta Vite automáticamente
(Build: `npm run build`, Output: `dist`).

## Usuario semilla

Los datos ficticios ("Nicolás") viven en `src/data/mockData.js` y se cargan la
primera vez que abres la app. Desde ahí en adelante todo se persiste en
`localStorage` del navegador (`src/services/storage.js`). Puedes reiniciar a
los datos de ejemplo desde **Configuración → Reiniciar a datos de ejemplo**.

## Qué se implementó en esta iteración (Fases 1, 2 y la mayor parte de 3)

- Navegación real de 5 secciones (Inicio, Movimientos, Planes, Análisis,
  Copiloto) + secundarias (Cuentas, Configuración), sidebar en desktop y
  bottom nav en móvil, totalmente responsive.
- Modelo de datos separado: `Account`, `Transaction`, `Category`, `Debt`,
  `Goal`, todo en `src/context/FinanceContext.jsx` con persistencia
  automática.
- Motor financiero en `src/services/financial/*` (sin JSX, funciones puras):
  `calculateFinancialHealth()`, `calculateAvailableMoney()`, `projectBalance()`,
  `generateInsights()`, `evaluatePurchase()`, `answerQuestion()` (Copiloto),
  simuladores de metas y de pago adicional de deuda.
- **Inicio**: salud financiera (score + 5 componentes), dinero realmente
  disponible (saldo − comprometido), resumen mensual comparado con el mes
  anterior, proyección a 30 días, próximos compromisos, insight principal,
  accionesrápidas funcionales.
- **Movimientos**: alta y baja de ingresos/gastos, filtro por categoría,
  cuenta y texto, orden, actualiza cuentas y dashboard en tiempo real.
- **Cuentas**: alta/baja, saldo total vs. deuda de tarjetas.
- **Planes**: Objetivos (con simulador "¿qué pasa si ahorro X?"), Fondo de
  emergencia (calculado sobre gastos esenciales reales), Deudas (con
  simulador de pago adicional).
- **Análisis**: gastos por categoría (gráfico), comparación mensual
  (gráfico), tendencias por categoría, listado de insights.
- **Copiloto**: interfaz de chat que responde con datos reales del usuario
  (sin IA todavía, arquitectura lista para conectarla).
- **¿Puedo permitírmelo?** y **Flujo de dinero**: herramientas standalone,
  accesibles desde acciones rápidas del dashboard.

## Qué falta / simplificaciones conocidas de esta iteración

- **Editar** movimientos, cuentas, objetivos y deudas: hoy solo hay alta y
  baja. Es lo primero que agregaría en la siguiente iteración.
- El simulador de deuda usa interés simple mensual aproximado, no una tabla
  de amortización completa capital/interés mes a mes.
- Los compromisos recurrentes (alquiler, servicios, cuotas) no se concilian
  todavía con las transacciones ya registradas ese mes — puede haber una
  ligera duplicación conceptual entre "próximos compromisos" y "gastos ya
  registrados". Se resuelve en la próxima fase de "presupuesto inteligente".
- Sin integraciones bancarias reales, QR o notificaciones (tal como pediste
  para este MVP).
- Sin TypeScript todavía (decisión explicada en el análisis previo).

## Próxima iteración sugerida (Fases 4-6 restantes)

1. Edición completa de todas las entidades (movimientos, cuentas, deudas,
   objetivos).
2. Presupuesto inteligente sugerido a partir del historial.
3. Alertas inteligentes como notificaciones persistentes (no solo insights
   dentro de Análisis).
4. Tabla de amortización real para el simulador de deudas.
5. Conectar el Copiloto a un modelo de IA real (Claude API), manteniendo
   `copilotEngine.js` como la capa que decide qué contexto financiero
   pasarle al modelo.
