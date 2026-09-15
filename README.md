# Copiloto Financiero

SPA React/Vite con reglas financieras puras, persistencia local compatible y persistencia PostgreSQL para usuarios autenticados mediante Supabase.

## Arquitectura

- `src/auth`: sesión, Google OAuth y redirecciones seguras.
- `src/repositories`: contrato, adaptador local y adaptador Supabase.
- `src/services/financial`: reglas puras; no consulta Supabase ni `localStorage`.
- `src/services/import`: detección, resumen, huella e importación idempotente de datos locales.
- `supabase/migrations`: esquema versionado, libro, funciones transaccionales y RLS.
- `supabase/tests`: comprobaciones de aislamiento entre usuarios.

Los usuarios autenticados usan PostgreSQL como fuente principal. `VITE_DATA_MODE=local` existe únicamente para desarrollo y compatibilidad. No se implementó edición offline; cuando no hay conexión, las escrituras deben reintentarse con la misma clave de operación.

El esquema normalizado contiene `profiles`, `accounts`, `credit_cards`, `transactions`, `transaction_entries`, `goals`, `savings_contributions`, `debts`, `recurring_transactions`, `user_financial_settings`, `local_import_batches` y `applied_operations`. Las relaciones compuestas incluyen `user_id`, por lo que una referencia a cuenta, meta o tarjeta de otro usuario falla también si el cliente ha sido manipulado. Los saldos se derivan de `transaction_entries`; no existe una segunda columna de saldo editable en `accounts`.

## Variables

Copiar `.env.example` a `.env.local` y completar:

- `VITE_SUPABASE_URL`: Project URL de Supabase. Puede llegar al navegador.
- `VITE_SUPABASE_ANON_KEY`: clave pública/anon. Puede llegar al navegador porque RLS limita el acceso.
- `VITE_APP_URL`: `http://localhost:5173` en desarrollo y el origen público en cada entorno.
- `VITE_DATA_MODE`: `supabase` para autenticación; `local` solo para desarrollo sin proveedor.

Este proyecto usa Vite, por eso las variables públicas llevan el prefijo `VITE_` en lugar de `NEXT_PUBLIC_`.

Nunca colocar una `service_role` en una variable `VITE_*` ni en código cliente.

## Configuración manual de Supabase y Google

1. Crear un proyecto Supabase de desarrollo y elegir región.
2. Instalar la CLI de Supabase, ejecutar `supabase start` y después `supabase db reset` para aplicar `supabase/migrations/202609150001_finance_auth_schema.sql` localmente.
3. Ejecutar `supabase test db` para validar `supabase/tests/rls.sql` con usuarios aislados. Revisar el SQL antes de vincular cualquier proyecto remoto.
4. En Google Cloud, configurar la pantalla de consentimiento OAuth.
5. Crear credenciales Web OAuth 2.0.
6. En Google, autorizar la URL callback que muestra Supabase para el proveedor Google.
7. En Supabase Authentication > Providers, habilitar Google con el Client ID y Client Secret.
8. En Supabase Authentication > URL Configuration, añadir `http://localhost:5173/auth/callback`, las URLs de preview autorizadas y la URL de producción.
9. Configurar las tres variables públicas en Development, Preview y Production de Vercel.
10. Revisar política de privacidad, retención, exportación y eliminación antes de producción.

RLS está habilitado en todas las tablas financieras. Las políticas permiten `select`, `insert`, `update` y `delete` solo cuando `auth.uid() = user_id`; las claves foráneas compuestas refuerzan que las relaciones pertenezcan al mismo usuario. Los RPC usan `security invoker`, requieren una sesión autenticada y no dependen de una clave administrativa.

## Desarrollo y pruebas

```sh
pnpm install
pnpm test
pnpm build
pnpm dev
```

Para revisar la UI sin credenciales se puede usar `VITE_DATA_MODE=local`. Para probar OAuth, usar usuarios de prueba y un proyecto Supabase de desarrollo.

## Migración del navegador

Después del primer acceso, la app detecta `copiloto-financiero:estado-financiero-v1`, excluye datos de demostración, normaliza el esquema y muestra un resumen. La importación usa una huella SHA-256 y un identificador estable; la función PostgreSQL rechaza la mezcla automática si ya existen datos remotos. La copia local nunca se elimina automáticamente.

Al terminar, la aplicación compara cantidades, relaciones y saldos redondeados a centavos. Una importación ya completada se reconoce por su huella y no se repite. Si la cuenta remota contiene otros datos, la interfaz bloquea la combinación automática y conserva ambos conjuntos para una conciliación futura.

## Saldo e integridad

El saldo remoto se deriva de `transaction_entries`. `apply_finance_state` ejecuta la cuenta y el movimiento inicial en una sola transacción, usa revisión optimista e idempotencia y reconcilia cuentas antiguas mediante un ajuste `migration_balance`. `initial_balance`, ajustes y transferencias siguen excluidos de los ingresos operativos por los servicios de dominio.

## Limitaciones

- La eliminación irreversible de la cuenta está bloqueada hasta definir una política legal de retención.
- La primera versión requiere conexión para guardar.
- Los IDs históricos se conservan como identificadores de cliente para no romper relaciones durante la migración.
- Las migraciones y pruebas RLS no se ejecutan contra un servicio remoto sin credenciales de desarrollo.
- Antes del despliegue deben revisarse SQL, redirect URLs, RLS, backups y variables por entorno.

## Procedimiento futuro de despliegue

Este repositorio no ejecuta el despliegue. Cuando las verificaciones locales y legales estén aprobadas: aplicar primero la migración en un proyecto de desarrollo, ejecutar las pruebas RLS, probar Google OAuth con un usuario de prueba, aplicar la migración revisada al proyecto de producción, configurar las variables por entorno en Vercel y verificar las URLs de retorno antes de promover una compilación. Mantener una copia de seguridad de PostgreSQL y no retirar el almacenamiento local hasta validar importaciones reales.
