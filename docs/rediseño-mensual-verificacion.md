# Rediseño mensual: implementación y verificación local

## Actualización: publicación autorizada

Posteriormente el usuario autorizó push y despliegue. Las migraciones monthly_planning, card_ledger_reconciliation y aggregated_balance_precision se aplicaron correctamente en Supabase. La última corrige un error anterior: SUM(bigint) devuelve numeric y el lector solo admitía from_minor(bigint). Se conserva precisión decimal con una sobrecarga numeric y permisos solo para authenticated.

La prueba real de PostgreSQL generada por scripts/planning-sql-fixture.mjs aprobó persistencia de planes/asignaciones/snapshots, asientos de tarjeta, edición, eliminación, idempotencia e aislamiento entre dos usuarios. Toda la prueba usó usuarios ficticios y ROLLBACK, sin dejar datos de demostración. El asesor de seguridad de Supabase no devolvió alertas. Los párrafos siguientes describen la entrega local anterior; la validación SQL indicada allí como pendiente ya se completó. Queda sin recorrer el flujo de navegador con una cuenta autenticada real y sin snapshots de cuotas históricas, tal como se explica más abajo.

Fecha: 16 de septiembre de 2026. Cambios locales, sin push ni despliegue. No se modificó la base de datos remota.

## Navegación y flujos

La navegación principal es Inicio, Movimientos, Mi mes, Planes de Ahorro y Copiloto. Cuentas conserva acceso secundario desde Inicio y Configuración. Las rutas antiguas /analisis y /planes redirigen conservando parámetros a /mi-mes y /planes-ahorro. Inicio resume plan, disponible, ahorros, compromisos, salud, proyección, alertas y objetivos.

Mi mes incorpora un recorrido de cinco preguntas para configurar el mes completo. Solo se crean o editan planes actuales y futuros; los anteriores son de consulta. No solicita fecha de cobro. El objetivo de cierre y los aportes previstos admiten cero. La prioridad personaliza recomendaciones sin modificar la puntuación. Una estimación no genera movimientos. La pregunta sobre registros completos marca la confianza y no modifica saldos.

Los pagos reales de compromisos, deudas y tarjetas abren Movimientos con datos precargados. El pago completo por un monto distinto del estimado necesita un movimiento real vinculado. Editar o borrar ese movimiento recalcula el pendiente. Los aportes usan la misma operación de dominio aunque se abran desde Planes de Ahorro.

## Modelo de datos

Esquema persistido versión 3, compatible con los datos anteriores:

- Categorías: id estable, nombre, tipo ingreso/gasto, clasificación fijo/variable para gastos, versión y estado archivado. Saldo inicial continúa siendo especial y no operativo.
- Movimientos y partidas del plan: categorySnapshot conserva nombre, tipo y clasificación histórica. Renombrar, archivar o reclasificar no reescribe el pasado. Las categorías personalizadas provienen de la misma colección en los selectores.
- monthlyPlans: mes, listas incomes/expenses/savings, closingTarget, priority, recordsComplete, emergency, fechas y revisiones. Los cambios conservan la estimación original y las versiones anteriores.
- Los pagos incluyen planMonth, planItemId, completesCommitment y, cuando corresponde, linkedDebtId/linkedCreditCardId.
- savingsAllocations relaciona dinero existente con cuenta y objetivo. savingsContributions mantiene método, fecha, importe y relaciones. processedRequestIds evita duplicar operaciones reenviadas.

La migración local conserva cuentas, importes, movimientos, objetivos, deudas y configuraciones; normaliza categorías y añade colecciones/campos faltantes. No inventa ingresos ni duplica saldos iniciales. Un objetivo anterior con ahorro no respaldado requiere una vinculación explícita con dinero existente: esa conciliación no aumenta el objetivo ni se cuenta como aporte nuevo.

## Fórmulas compartidas

Los saldos de cuentas y el libro de movimientos son la fuente de verdad. Los importes se redondean a centavos.

Dinero total = suma de cuentas de activo; tarjetas excluidas. No se presenta como patrimonio neto.

Base para gastar = dinero total − cuentas de ahorro − asignaciones protegidas en cuentas de uso diario. Una asignación en una cuenta de ahorro se excluye una sola vez.

Disponible hoy = base para gastar − fijos pendientes − cuotas/mínimos pendientes no incluidos en fijos − compromisos anteriores impagos.

Disponible estimado al cierre = base para gastar + ingresos operativos pendientes − fijos pendientes − variables pendientes − aportes previstos pendientes − cuotas/mínimos externos pendientes − compromisos anteriores impagos.

Por categoría de ingreso o variable, pendiente = max(estimación mensual − real registrado, 0). Un fijo completado por un pago vinculado deja pendiente cero aunque el pago sea menor que la estimación. No se vuelve a descontar el gasto ya registrado. Un gasto inesperado reduce el saldo sin reducir una partida que no le corresponde. Superar un límite mantiene pendiente cero pero genera una advertencia para revisar posibles gastos adicionales.

Alertas variables: desde 85% del límite, alcanzado y superado. El límite no bloquea el registro. Las comparaciones operativas usan periodos equivalentes y excluyen aperturas, ajustes y transferencias propias.

## Ahorro y continuidad

Proteger dinero reduce el disponible, no los activos. Transferir a ahorro produce dos asientos internos y conserva el total; no es ingreso ni gasto de consumo. Liberar una asignación actualiza el objetivo y la protección. Si está en una cuenta de ahorro, volver al disponible requiere también una transferencia explícita a una cuenta de uso diario.

Los aportes necesitan saldo real no asignado y respetan los compromisos actuales. No se permite crear ahorro respaldado solo por estimaciones. No hay asignación automática al cierre. Se ofrecen todo, parte o nada mediante el flujo de Movimientos.

El cambio de mes conserva cuentas y protecciones, sin generar ingresos. Los fijos anteriores impagos siguen afectando el disponible. Para consultar un cierre anterior se exige conciliación del libro; si no puede reconstruirse, el saldo queda no disponible en vez de inventarse. Las cuotas históricas de tarjetas/deudas no cuentan con snapshots completos, por lo que un cierre con esos instrumentos se muestra no disponible; se conservan movimientos y estimado/real. La apertura de un plan futuro es provisional y se recalcula con los datos reales.

## Salud financiera y Copiloto

Fórmula centralizada en monthlyPlan.js: Control del mes 35%, Dinero para imprevistos 25%, Cuotas y compromisos 25%, Objetivos y margen 15%. Los componentes explican base numérica y acción. El margen usa ingresos frente a gastos estimados/reales y cuotas externas; reserva usa dinero declarado limitado por su respaldo; deuda usa cuotas/ingresos; planificación usa margen disponible al cierre, no el objetivo elegido.

No tener ahorros es cero conocido; no informarlos es desconocido. Los desconocidos no tienen barra ni puntaje. El puntaje interno se agrupa en bandas de cinco puntos y se normaliza sobre componentes conocidos; la interfaz y el Copiloto omiten el puntaje global cuando es parcial o de baja confianza. Crear una meta o bajar el objetivo no mejora la salud.

Copiloto, compra, Inicio y Mi mes comparten reglas. El Copiloto explica disponible, cierre, límites, efectos de aportes y diferencias entre activos y ahorros. Las sugerencias permanecen accesibles.

## Persistencia y SQL pendiente

Invitados mantienen almacenamiento local aislado. Usuarios autenticados conservan RPC, revisión, idempotencia y políticas de acceso. El repositorio remoto comprueba soporte del nuevo esquema y saldos guardados, y bloquea operaciones que un servidor antiguo perdería. La conciliación acepta el orden distinto de claves JSONB y comprueba relaciones nuevas. Demostración es temporal y no escribe datos de prueba en el repositorio real.

Migraciones preparadas, no aplicadas:

1. 202609160001_monthly_planning.sql añade finance_planning con RLS por propietario y extensiones para categorías, planes, asignaciones y metadatos. Envuelve las RPC existentes sin duplicar saldos y conserva campos omitidos por clientes anteriores.
2. 202609160002_card_ledger_reconciliation.sql registra la contraparte explícita de pagos de tarjeta y corrige la reconciliación de ajustes migrados, manteniendo revisión e idempotencia.

Antes de habilitar el nuevo cliente autenticado: probar ambas migraciones en una copia de desarrollo con las migraciones previas, verificar lectura/escritura, importación, pagos/editado y aislamiento entre dos usuarios. No hay PostgreSQL, psql ni Docker disponibles en este entorno: se verificó SQL estáticamente y el adaptador remoto con RPC simuladas; no equivale a una ejecución real de las migraciones.

## Verificación realizada

- node --test tests/*.test.js: 65 pruebas, 65 aprobadas, ninguna omitida. Incluyen dominio, reducer real, migración local, adaptadores local/remoto simulado, edición y reversión de pagos, JSONB, idempotencia y los 21 casos solicitados.
- Compilación Vite local con scripts/verify-local-build.mjs: aprobada. Sin dependencias nuevas. Advertencia de paquete principal mayor de 500 kB; queda optimización de carga por rutas.
- git diff --check con normalización de finales de línea: aprobado. El proyecto no incluye un script de lint separado.
- Recorrido navegador local con datos ficticios, sin tocar producción: onboarding sin ingresos/gastos, apertura única Bs 2.400, plan con fijo Bs 900 y variable Bs 800, pago completo Bs 850 sin residual, objetivo Viaje y protección Bs 500, gasto Alimentación Bs 680 con alerta al 85%, categoría Mascotas compartida, consulta de ahorro Bs 1.000 y sugerencias reutilizables.
- Antes del ingreso real: total Bs 870, protegido Bs 500, disponible Bs 370, cierre Bs 250. Después de ingreso real Bs 2.000: total Bs 2.870, disponible Bs 2.370 y cierre Bs 2.250 en Inicio y Mi mes; guía de primeros movimientos desapareció.
- Móvil 390 × 844 y escritorio 1440 × 900 revisados visualmente. Navegación móvil completa y sin desbordamiento horizontal. Tab/Escape y devolución del foco comprobados. Sin errores de consola en el recorrido observado.

Archivos principales: App.jsx, navConfig.js, Inicio.jsx, Analisis.jsx, Planes.jsx, Movimientos.jsx, TransactionForm.jsx, MonthlyPlanPanel.jsx, CategoryManager.jsx, SavingsOperationForm.jsx, financeReducer.js, monthlyPlan.js, savings.js, categories.js, migrations.js, supabaseFinanceRepository.js y las dos migraciones SQL.
