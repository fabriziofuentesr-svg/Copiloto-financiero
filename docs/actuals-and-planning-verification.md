# Separación de hechos y planificación (17 de septiembre de 2026)

Mi mes separa saldos actuales y movimientos operativos de límites y proyecciones. `actualMonth` y `actualFinancialHealth` son funciones puras compartidas. Saldo inicial, ajustes, transferencias y registros futuros no constituyen ingresos operativos. Las vistas históricas identifican expresamente los saldos actuales.

`Ahorros` vincula cuentas de ahorro existentes mediante asignaciones, sin crear activos ni movimientos ficticios. Los identificadores de cuentas inicializadas evitan volver a asignar dinero al recargar. Un plan equivalente se reutiliza conservando su identificador. Reasignar cambia el destino de una asignación, conserva las cuentas y queda en el historial con `method: reassign`, excluido del ahorro realizado y de los aportes mensuales nuevos.

Los aportes previstos guardan frecuencia mensual o semanal. Las semanas avanzan siete días; las fechas mensuales conservan el día de referencia y se limitan al último día del mes. La frecuencia es una intención, no una transferencia automática.

La migración SQL agrega metadatos de planes de ahorro a la tabla existente con RLS, conserva los RPC con revisión e idempotencia y valida fechas según la zona del perfil (respaldo America/La_Paz). Conserva movimientos futuros antiguos sin modificaciones y rechaza nuevos o editados. La auditoría remota encontró cero registros futuros. No se borraron movimientos ni se reescribieron saldos de usuarios.

Verificaciones: 87 pruebas Node; compilación Vite; integración SQL con usuarios ficticios y ROLLBACK (libro, tarjetas, edición, eliminación, asignaciones, idempotencia, aislamiento, metadatos, zona y rechazo de fechas futuras); navegador local (pestañas real/plan, asistente sin pregunta de registros completos, categorías horizontales, gráfico semanal, barras, nombres nuevos, escritura continua y centavos). No se observaron errores de consola en estos recorridos.

Limitaciones de verificación: el navegador disponible mantuvo un ancho interno cercano a 655 px pese a solicitar 390 y 1440 px; se comprobó ausencia de desbordamiento en el ancho efectivo, pero los dos tamaños exactos requieren una comprobación adicional. El proyecto no tiene análisis estático ni infraestructura E2E configurados. Vite conserva la advertencia existente sobre tamaño del paquete (~1 MB sin comprimir).
