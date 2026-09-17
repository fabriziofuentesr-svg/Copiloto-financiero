# Verificación: ubicación, reservas y gastos de ahorro

Fecha: 2026-09-17. Repositorio Copiloto-financiero, rama codex/integridad-financiera-flujos.

## Cambios y causa
La cuenta representa una ubicación real. El plan representa un propósito. spendingMoney resta exclusivamente savingsAllocations: el tipo ahorro no reserva el saldo completo. Antes, una cuenta de ahorro con 4000, sin reserva, quedaba con 0 libres: 0 + 2000 pendientes - 5000 gastos daba -3000. Ahora el mismo caso da 1000. No se añaden otra vez los ingresos cobrados.
Los gastos financiados usan savingsFunding {goalId, accountId, amount, goalName}. El reductor revierte y vuelve a aplicar saldo, reserva y deuda en una operación pura; las excepciones conservan el estado previo. El uso del objetivo se deriva de los gastos vigentes, no de liberaciones o reasignaciones.
Las previsiones de ahorro no modifican cuentas. Los aportes ejecutados pueden vincularse mediante planMonth. La transferencia de ahorro mueve saldo y reserva; reasignar cambia solo el propósito. Las claves de operación evitan repetir gastos, aportes y transferencias.
Los compromisos no determinan la inclusión de un gasto. Los pagos por categoría se distribuyen sin marcar todos los compromisos como pagados; los excesos mantienen una alerta. La financiación prevista con reservas se limita al respaldo disponible, compartido sin duplicaciones.

## Persistencia y migración
Esquema cliente 4, conservando cuentas, movimientos, metas, reservas y previsiones anteriores. No se asignan nuevas ubicaciones automáticamente. El avance anterior sin respaldo conserva su monto y solicita conciliación desde Apartar dinero / Vincular avance anterior.
Se conservan las asignaciones ya persistidas; pueden liberarse o reasignarse explícitamente. El plan estándar se reutiliza. La confirmación inicial se guarda en los metadatos del plan para sobrevivir al acceso remoto.
Migraciones remotas savings_location_and_expense_funding y savings_funding_calendar_guard: validación de propiedad, respaldo, unicidad, conciliación entre eventos y usos; validación de cambios de financiación en fechas futuras. Las escrituras mantienen revisión optimista, idempotencia, SECURITY INVOKER y RLS existentes. No se reescribe ningún registro financiero existente.

## Pruebas ejecutadas
- node --test tests/*.test.js: 118 pruebas, 118 correctas.
- scripts/verify-local-build.mjs: compilación Vite correcta; aviso de bundle grande ya existente.
- git diff --check: sin errores de whitespace; avisos de conversión LF/CRLF.
- scripts/planning-sql-fixture.mjs contra Supabase: reservas, gasto financiado, reversión, pago de tarjeta, edición, borrado, reintentos, revisión obsoleta, reserva excesiva, atomicidad e aislamiento. Datos ficticios dentro de BEGIN/ROLLBACK.
- Asesor de seguridad Supabase: sin avisos.

## Recorrido de navegador
Chrome, origen local 127.0.0.1:4181, invitado ficticio Prueba reservas:
1. Perfil sin movimientos iniciales; efectivo1000 y banco4000.
2. Confirmación explícita de300 y1200: Inicio muestra total5000, reserva1500, libre3500.
3. Reasignación del banco desde Ahorros hacia Celular, sin transferencia.
4. Compra1200 desde banco con Celular: gasto real visible, banco2800, reserva del plan0, uso1200 y progreso100%.
5. Mi mes muestra gasto1200 y disponible global3500; Cuentas muestra efectivo1000/reserva300/libre700 y banco2800/reserva0/libre2800.
6. Plan creado después del gasto: Compras1500/real1200/pendiente300.
7. Previsión200 para Ahorros: cierre3000, cuentas y reserva sin cambios. Ejecutar200 desde efectivo deja reserva500, pendiente0 y el mismo cierre3000.
8. Viewports reales390x844 y1440x900, sin desbordamiento horizontal. Sin errores de consola durante el recorrido.
No se utilizaron datos reales ni se probó un nuevo inicio de sesión OAuth. La persistencia autenticada y aislamiento se probaron por RPC con usuarios ficticios revertidos. No hay infraestructura de lint o E2E configurada.
