# Copiloto Financiero

Prototipo de copiloto financiero personal para Bolivia, construido con React + Vite.

## Ejecutar en local

```bash
npm install
npm run dev
```

Abre la URL que muestra la terminal (por defecto http://localhost:5173).

## Subir a GitHub

```bash
git init
git add .
git commit -m "Copiloto financiero: primer prototipo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

## Desplegar en Vercel

1. Entra a https://vercel.com/new e importa el repositorio de GitHub.
2. Vercel detecta automáticamente el framework "Vite". Configuración por defecto:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
3. Haz clic en "Deploy". En un par de minutos tendrás la URL pública.

Cada `git push` a `main` vuelve a desplegar automáticamente.

## Nota sobre el guardado de datos

El prototipo original (creado como artifact de Claude) usa `window.storage`,
una API de persistencia que solo existe dentro del entorno de artifacts de
Claude.ai. Para que la app funcione igual una vez desplegada de forma
independiente, `src/storage.js` agrega un polyfill: si `window.storage` no
existe, lo crea usando `localStorage` con la misma interfaz (`get`, `set`,
`delete`, `list`). `App.jsx` no cambió ni una línea — sigue llamando a
`window.storage` exactamente igual, solo que ahora, fuera de Claude.ai, los
datos quedan guardados en el navegador del usuario en vez de la nube.

Esto significa que los datos se guardan por navegador/dispositivo, no en un
backend compartido. Para sincronizar entre dispositivos hace falta agregar
un backend propio (ver siguiente sección).

## Qué extender primero

1. **Backend real con base de datos**: hoy los datos viven en el navegador
   (localStorage). Lo primero a añadir sería una API sencilla (por ejemplo
   con Supabase, Firebase o un backend propio) para persistir el perfil
   financiero del usuario en la nube, con login, y así poder usarlo desde
   el celular y la computadora sin perder datos.
2. **Motor de reglas más fino**: los umbrales de riesgo (DTI, fondo de
   emergencia, tasas "caras") están fijos en el código. Convertirlos en
   parámetros ajustables (o basados en datos reales de consumo en Bolivia)
   mejoraría la precisión de los diagnósticos.
3. **Explicaciones conversacionales**: usar la API de Claude para que el
   usuario pueda preguntar en lenguaje natural ("¿puedo comprarme algo de
   Bs 500 este mes?") y recibir una respuesta basada en los mismos cálculos
   del motor financiero, en vez de solo ver el dashboard.
4. **Historial y tendencias**: guardar el estado mes a mes (no solo el
   perfil actual) para poder mostrar si la salud financiera del usuario
   mejora o empeora con el tiempo.
