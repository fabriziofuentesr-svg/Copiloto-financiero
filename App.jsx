import React, { useState, useEffect, useMemo } from "react";
import { Wallet, ArrowLeftRight, CreditCard, PiggyBank, Stethoscope, Trash2, Sparkles, RotateCcw } from "lucide-react";

// ---------------------------------------------------------------------------
// Constantes de dominio
// ---------------------------------------------------------------------------
const STORAGE_KEY = "copiloto-financiero-perfil-v1";

const FRECUENCIAS = [
  { value: "mensual", label: "Mensual", factor: 1 },
  { value: "quincenal", label: "Quincenal", factor: 2 },
  { value: "semanal", label: "Semanal", factor: 4.33 },
  { value: "variable", label: "Variable (estimado mensual)", factor: 1 },
];

const CATEGORIAS_GASTO = [
  "Vivienda (alquiler/anticrético)",
  "Alimentación",
  "Transporte",
  "Servicios (luz, agua, internet)",
  "Salud",
  "Educación",
  "Entretenimiento",
  "Otros",
];

const TIPOS_DEUDA = [
  { value: "tarjeta_credito", label: "Tarjeta de crédito" },
  { value: "prestamo_bancario", label: "Préstamo bancario" },
  { value: "fondo_categoria", label: "Préstamo de fondo / categoría laboral" },
  { value: "prestamista_informal", label: "Prestamista informal" },
  { value: "prenda", label: "Casa de empeño / prenda" },
  { value: "otro", label: "Otro" },
];

const TIPOS_AHORRO = [
  { value: "efectivo", label: "Efectivo en casa" },
  { value: "banco_bs", label: "Cuenta bancaria en bolivianos" },
  { value: "banco_usd", label: "Cuenta bancaria en dólares" },
  { value: "pasanaku", label: "Pasanaku / ahorro grupal" },
  { value: "otro", label: "Otro" },
];

const TABS = [
  { id: "resumen", label: "Resumen", icon: Wallet },
  { id: "flujo", label: "Ingresos y gastos", icon: ArrowLeftRight },
  { id: "deudas", label: "Deudas", icon: CreditCard },
  { id: "ahorro", label: "Ahorro y metas", icon: PiggyBank },
  { id: "diagnostico", label: "Diagnóstico", icon: Stethoscope },
];

const EJEMPLO = {
  ingresos: [
    { id: "i1", fuente: "Sueldo fijo", monto: 4500, frecuencia: "mensual" },
    { id: "i2", fuente: "Venta por catálogo (extra)", monto: 800, frecuencia: "variable" },
  ],
  gastos: [
    { id: "g1", categoria: "Vivienda (alquiler/anticrético)", monto: 1200, tipo: "fijo" },
    { id: "g2", categoria: "Servicios (luz, agua, internet)", monto: 250, tipo: "fijo" },
    { id: "g3", categoria: "Alimentación", monto: 950, tipo: "variable" },
    { id: "g4", categoria: "Transporte", monto: 300, tipo: "variable" },
    { id: "g5", categoria: "Entretenimiento", monto: 220, tipo: "variable" },
  ],
  deudas: [
    { id: "d1", nombre: "Tarjeta Banco Unión", tipo: "tarjeta_credito", saldo: 3000, tasaAnual: 42, cuota: 350 },
    { id: "d2", nombre: "Préstamo de doña Rosa", tipo: "prestamista_informal", saldo: 1000, tasaAnual: 96, cuota: 150 },
  ],
  ahorros: [
    { id: "a1", nombre: "Efectivo guardado", tipo: "efectivo", monto: 500 },
    { id: "a2", nombre: "Caja de ahorro BNB", tipo: "banco_bs", monto: 800 },
  ],
  metas: [
    { id: "m1", nombre: "Cuota inicial para moto", objetivo: 5000, actual: 800, plazoMeses: 8 },
  ],
};

const PERFIL_VACIO = { ingresos: [], gastos: [], deudas: [], ahorros: [], metas: [] };

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
let contador = 0;
function uid(prefijo) {
  contador += 1;
  return `${prefijo}-${Date.now()}-${contador}`;
}

function n(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

const fmtBs = (v) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 0 }).format(
    Math.round(v || 0)
  );

const pct = (v) => `${Math.round((v || 0) * 100)}%`;

// ---------------------------------------------------------------------------
// Motor financiero (funciones puras)
// ---------------------------------------------------------------------------
function calcularIngresoMensual(ingresos) {
  return ingresos.reduce((acc, i) => {
    const f = FRECUENCIAS.find((f) => f.value === i.frecuencia)?.factor || 1;
    return acc + n(i.monto) * f;
  }, 0);
}

function calcularGastos(gastos) {
  const fijos = gastos.filter((g) => g.tipo === "fijo").reduce((a, g) => a + n(g.monto), 0);
  const variables = gastos.filter((g) => g.tipo === "variable").reduce((a, g) => a + n(g.monto), 0);
  return { fijos, variables, total: fijos + variables };
}

function calcularDeudas(deudas) {
  const cuotas = deudas.reduce((a, d) => a + n(d.cuota), 0);
  const saldoTotal = deudas.reduce((a, d) => a + n(d.saldo), 0);
  const caras = deudas.filter((d) => d.tipo === "prestamista_informal" || n(d.tasaAnual) > 60);
  const cuotasCaras = caras.reduce((a, d) => a + n(d.cuota), 0);
  return { cuotas, saldoTotal, caras, cuotasCaras };
}

function calcularAhorros(ahorros) {
  const liquido = ahorros
    .filter((a) => a.tipo === "efectivo" || a.tipo === "banco_bs" || a.tipo === "banco_usd")
    .reduce((acc, a) => acc + n(a.monto), 0);
  const total = ahorros.reduce((acc, a) => acc + n(a.monto), 0);
  const enDolares = ahorros.filter((a) => a.tipo === "banco_usd").reduce((acc, a) => acc + n(a.monto), 0);
  return { liquido, total, enDolares };
}

function construirDiagnostico(perfil) {
  const ingresoMensual = calcularIngresoMensual(perfil.ingresos);
  const { fijos: gastosFijos, variables: gastosVariables, total: gastosTotal } = calcularGastos(perfil.gastos);
  const { cuotas: cuotasDeuda, saldoTotal: saldoDeudaTotal, caras: deudasCaras, cuotasCaras } = calcularDeudas(
    perfil.deudas
  );
  const { liquido: ahorroLiquido, total: ahorroTotal } = calcularAhorros(perfil.ahorros);

  const disponibleAntesAhorro = ingresoMensual - gastosFijos - cuotasDeuda;
  const ahorroRecomendado = Math.max(0, disponibleAntesAhorro) * 0.15;
  const libreReal = disponibleAntesAhorro - gastosVariables - ahorroRecomendado;

  const dti = ingresoMensual > 0 ? cuotasDeuda / ingresoMensual : 0;
  const tasaAhorro =
    ingresoMensual > 0 ? (ingresoMensual - gastosFijos - gastosVariables - cuotasDeuda) / ingresoMensual : 0;
  const gastoMensualTotal = gastosFijos + gastosVariables;
  const fondoEmergenciaMeses = gastoMensualTotal > 0 ? ahorroLiquido / gastoMensualTotal : ahorroLiquido > 0 ? 3 : 0;

  // --- Puntaje de salud financiera (0-100) ---
  const puntoAhorro = clamp((tasaAhorro / 0.2) * 30, 0, 30);
  const puntoDti =
    dti <= 0.15 ? 25 : dti >= 0.6 ? 0 : clamp(25 * (1 - (dti - 0.15) / 0.45), 0, 25);
  const puntoFondo = clamp((fondoEmergenciaMeses / 3) * 25, 0, 25);
  const shareCara = cuotasDeuda > 0 ? cuotasCaras / cuotasDeuda : 0;
  const puntoDeudaCara = clamp(20 * (1 - shareCara), 0, 20);
  const puntajeSalud = Math.round(puntoAhorro + puntoDti + puntoFondo + puntoDeudaCara);

  let nivelSalud = "Crítica";
  if (puntajeSalud > 80) nivelSalud = "Sólida";
  else if (puntajeSalud > 60) nivelSalud = "Estable";
  else if (puntajeSalud > 40) nivelSalud = "Débil";

  // --- Riesgos ---
  const riesgos = [];
  if (disponibleAntesAhorro - gastosVariables < 0) {
    riesgos.push({
      nivel: "alto",
      titulo: "Estás gastando más de lo que ingresa a tu bolsillo",
      detalle:
        "Tus gastos fijos, variables y cuotas de deuda juntos superan tu ingreso mensual. Cualquier imprevisto te dejará sin cómo responder.",
    });
  }
  if (dti > 0.35) {
    riesgos.push({
      nivel: dti > 0.5 ? "alto" : "medio",
      titulo: `Tus cuotas de deuda se llevan ${pct(dti)} de tu ingreso`,
      detalle:
        "Por encima del 35% se considera sobreendeudamiento: cada vez queda menos margen para vivir y ahorrar, y un imprevisto puede forzarte a atrasarte.",
    });
  }
  if (fondoEmergenciaMeses < 1) {
    riesgos.push({
      nivel: "alto",
      titulo: "No tienes fondo de emergencia",
      detalle: "Sin ahorro líquido, un gasto médico o la pérdida de un ingreso te obligaría a endeudarte de inmediato.",
    });
  } else if (fondoEmergenciaMeses < 3) {
    riesgos.push({
      nivel: "medio",
      titulo: `Tu fondo de emergencia cubre solo ${fondoEmergenciaMeses.toFixed(1)} meses`,
      detalle: "Lo recomendable es tener entre 3 y 6 meses de gastos cubiertos en ahorro de fácil acceso.",
    });
  }
  if (deudasCaras.length > 0) {
    const nombres = deudasCaras.map((d) => d.nombre || "sin nombre").join(", ");
    riesgos.push({
      nivel: "alto",
      titulo: `Tienes deuda muy cara: ${nombres}`,
      detalle:
        "Con tasas informales o de tarjeta por encima del 60% anual, cada mes que pasa el interés te come más que cualquier ahorro que puedas generar.",
    });
  }
  if (tasaAhorro >= 0 && tasaAhorro < 0.05 && disponibleAntesAhorro - gastosVariables >= 0) {
    riesgos.push({
      nivel: "medio",
      titulo: "Estás ahorrando menos del 5% de tu ingreso",
      detalle: "Un colchón de ahorro pequeño pero constante es lo que te protege de caer en deuda cara.",
    });
  }
  if (ahorroTotal > 0 && calcularAhorros(perfil.ahorros).enDolares === 0 && ahorroLiquido === ahorroTotal) {
    riesgos.push({
      nivel: "bajo",
      titulo: "Todo tu ahorro está en bolivianos o efectivo",
      detalle:
        "Diversificar una parte en dólares o en una cuenta bancaria reduce tu exposición si escasea el efectivo o sube el tipo de cambio paralelo.",
    });
  }
  if (perfil.ingresos.length === 1 && ingresoMensual > 0) {
    riesgos.push({
      nivel: "medio",
      titulo: "Dependes de una sola fuente de ingreso",
      detalle: "Si esa fuente falla un mes, no tienes otra entrada de dinero de respaldo.",
    });
  }

  const ordenNivel = { alto: 0, medio: 1, bajo: 2 };
  riesgos.sort((a, b) => ordenNivel[a.nivel] - ordenNivel[b.nivel]);

  // --- Recomendaciones ---
  const recomendaciones = [];
  const deudaCaraTop = deudasCaras.sort((a, b) => n(b.tasaAnual) - n(a.tasaAnual))[0];
  if (deudaCaraTop) {
    recomendaciones.push(
      `Prioriza cancelar "${deudaCaraTop.nombre || "tu deuda más cara"}" antes que cualquier otro ahorro: a una tasa cercana al ${n(
        deudaCaraTop.tasaAnual
      )}% anual, te está costando aproximadamente ${fmtBs((n(deudaCaraTop.saldo) * n(deudaCaraTop.tasaAnual)) / 100 / 12)} al mes solo en interés.`
    );
  }
  if (fondoEmergenciaMeses < 3) {
    const faltante = Math.max(0, gastoMensualTotal * 3 - ahorroLiquido);
    recomendaciones.push(
      `Aparta lo que puedas cada mes hasta juntar ${fmtBs(gastoMensualTotal * 3)} de fondo de emergencia (te faltan ${fmtBs(
        faltante
      )}).`
    );
  }
  if (dti > 0.35) {
    recomendaciones.push("Evita tomar deuda nueva hasta que tus cuotas bajen de 35% de tu ingreso mensual.");
  }
  if (tasaAhorro < 0.1 && ingresoMensual > 0) {
    recomendaciones.push("Automatiza un ahorro mínimo del 10% apenas recibas tu ingreso, antes de empezar a gastar.");
  }
  if (ahorroTotal > 0 && calcularAhorros(perfil.ahorros).enDolares === 0 && ahorroLiquido === ahorroTotal) {
    recomendaciones.push("Considera mover una parte de tu ahorro a dólares o a una cuenta bancaria formal.");
  }

  const metasCalculadas = perfil.metas.map((m) => {
    const restante = Math.max(0, n(m.objetivo) - n(m.actual));
    const aporteDisponible = Math.max(0, libreReal);
    const mesesAlRitmoActual = aporteDisponible > 0 ? Math.ceil(restante / aporteDisponible) : Infinity;
    const plazo = n(m.plazoMeses);
    const aporteNecesarioParaPlazo = plazo > 0 ? restante / plazo : null;
    const alcanzableEnPlazo = plazo > 0 ? aporteNecesarioParaPlazo <= aporteDisponible : null;
    return { ...m, restante, mesesAlRitmoActual, aporteNecesarioParaPlazo, alcanzableEnPlazo };
  });

  metasCalculadas.forEach((m) => {
    if (m.plazoMeses > 0) {
      if (m.alcanzableEnPlazo) {
        recomendaciones.push(
          `Vas bien con "${m.nombre}": aportando ${fmtBs(m.aporteNecesarioParaPlazo)} al mes la alcanzas en el plazo que te propusiste.`
        );
      } else {
        recomendaciones.push(
          `Tu meta "${m.nombre}" necesita ${fmtBs(m.aporteNecesarioParaPlazo)} al mes pero hoy te quedan libres ${fmtBs(
            Math.max(0, libreReal)
          )}: alarga el plazo o reduce gastos variables en ${fmtBs(m.aporteNecesarioParaPlazo - Math.max(0, libreReal))}.`
        );
      }
    }
  });

  return {
    ingresoMensual,
    gastosFijos,
    gastosVariables,
    gastosTotal,
    cuotasDeuda,
    saldoDeudaTotal,
    ahorroLiquido,
    ahorroTotal,
    disponibleAntesAhorro,
    ahorroRecomendado,
    libreReal,
    dti,
    tasaAhorro,
    fondoEmergenciaMeses,
    puntajeSalud,
    nivelSalud,
    desglosePuntaje: { puntoAhorro, puntoDti, puntoFondo, puntoDeudaCara },
    riesgos,
    recomendaciones,
    metasCalculadas,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function colorSalud(puntaje) {
  if (puntaje <= 40) return "var(--brick)";
  if (puntaje <= 60) return "var(--ochre)";
  if (puntaje <= 80) return "#5C8A72";
  return "var(--teal)";
}

// ---------------------------------------------------------------------------
// Piezas de UI reutilizables
// ---------------------------------------------------------------------------
function FilaLibro({ etiqueta, valor, fuerte }) {
  return (
    <div className="fila-libro">
      <span className={fuerte ? "fila-etiqueta fuerte" : "fila-etiqueta"}>{etiqueta}</span>
      <span className="fila-puntos" />
      <span className={fuerte ? "fila-valor fuerte" : "fila-valor"}>{valor}</span>
    </div>
  );
}

function BarraSalud({ puntaje }) {
  return (
    <div className="barra-salud-pista">
      <div
        className="barra-salud-relleno"
        style={{ width: `${clamp(puntaje, 0, 100)}%`, background: colorSalud(puntaje) }}
      />
    </div>
  );
}

function TarjetaRiesgo({ riesgo }) {
  const color = riesgo.nivel === "alto" ? "var(--brick)" : riesgo.nivel === "medio" ? "var(--ochre)" : "#6b7d78";
  return (
    <div className="riesgo" style={{ borderLeftColor: color }}>
      <div className="riesgo-titulo">{riesgo.titulo}</div>
      <div className="riesgo-detalle">{riesgo.detalle}</div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <label className="campo">
      <span className="campo-label">{label}</span>
      {children}
    </label>
  );
}

function BotonEliminar({ onClick }) {
  return (
    <button className="btn-icono" onClick={onClick} title="Eliminar" aria-label="Eliminar">
      <Trash2 size={15} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function CopilotoFinanciero() {
  const [perfil, setPerfil] = useState(PERFIL_VACIO);
  const [tab, setTab] = useState("resumen");
  const [cargado, setCargado] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) setPerfil(JSON.parse(res.value));
      } catch (e) {
        // sin datos previos todavía, se empieza en blanco
      } finally {
        setCargado(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!cargado) return;
    setEstadoGuardado("Guardando…");
    const t = setTimeout(async () => {
      try {
        const res = await window.storage.set(STORAGE_KEY, JSON.stringify(perfil), false);
        setEstadoGuardado(res ? "Guardado" : "No se pudo guardar");
      } catch (e) {
        setEstadoGuardado("No se pudo guardar");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [perfil, cargado]);

  const diag = useMemo(() => construirDiagnostico(perfil), [perfil]);

  const hayDatos =
    perfil.ingresos.length + perfil.gastos.length + perfil.deudas.length + perfil.ahorros.length > 0;

  function cargarEjemplo() {
    setPerfil(EJEMPLO);
    setTab("resumen");
  }
  function borrarTodo() {
    setPerfil(PERFIL_VACIO);
  }

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

        .app {
          --paper: #F3F0E4;
          --paper-raised: #EAE5D4;
          --ink: #22302C;
          --ink-soft: #55635C;
          --teal: #1F5C56;
          --ochre: #C1892E;
          --brick: #A63D2C;
          --line: #D3CCB6;
          font-family: 'IBM Plex Sans', sans-serif;
          background: var(--paper);
          color: var(--ink);
          min-height: 100%;
          padding: 28px 20px 60px;
          max-width: 900px;
          margin: 0 auto;
        }
        .app * { box-sizing: border-box; }
        .encabezado { margin-bottom: 22px; }
        .encabezado h1 {
          font-family: 'Lora', serif;
          font-weight: 600;
          font-size: clamp(1.6rem, 4vw, 2.1rem);
          margin: 0 0 4px;
        }
        .encabezado p { margin: 0; color: var(--ink-soft); font-size: 0.95rem; max-width: 60ch; }

        nav.tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          border-bottom: 1px solid var(--line);
          margin: 22px 0 24px;
        }
        nav.tabs button {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          font-family: inherit;
          font-size: 0.88rem;
          color: var(--ink-soft);
          padding: 9px 12px 11px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        nav.tabs button.activo { color: var(--ink); border-bottom-color: var(--ochre); font-weight: 500; }
        nav.tabs button:hover { color: var(--ink); }

        section.panel { animation: aparecer 0.25s ease; }
        @keyframes aparecer { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

        .bloque {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 20px 22px;
          margin-bottom: 18px;
        }
        .bloque h2 {
          font-family: 'Lora', serif;
          font-weight: 600;
          font-size: 1.05rem;
          margin: 0 0 14px;
        }
        .bloque h3 {
          font-size: 0.82rem;
          text-transform: none;
          color: var(--ink-soft);
          margin: 0 0 10px;
          font-weight: 500;
        }

        .hero-numero {
          font-family: 'Lora', serif;
          font-weight: 600;
          font-size: clamp(2.3rem, 7vw, 3.4rem);
          color: var(--teal);
          line-height: 1;
          margin: 6px 0 2px;
        }
        .hero-etiqueta { color: var(--ink-soft); font-size: 0.92rem; }
        .hero-negativo { color: var(--brick); }

        .fila-libro {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 7px 0;
          border-bottom: 1px dotted var(--line);
          font-size: 0.9rem;
        }
        .fila-libro:last-child { border-bottom: none; }
        .fila-etiqueta { color: var(--ink-soft); white-space: nowrap; }
        .fila-etiqueta.fuerte { color: var(--ink); font-weight: 500; }
        .fila-puntos { flex: 1; border-bottom: 1px dotted var(--line); transform: translateY(-4px); }
        .fila-valor { white-space: nowrap; font-variant-numeric: tabular-nums; }
        .fila-valor.fuerte { font-weight: 600; }

        .grid-salud {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 14px;
        }
        .barra-salud-pista {
          height: 9px;
          background: var(--paper-raised);
          border-radius: 2px;
          overflow: hidden;
        }
        .barra-salud-relleno { height: 100%; transition: width 0.4s ease; }
        .salud-numero { font-family: 'Lora', serif; font-weight: 600; font-size: 1.5rem; }
        .salud-nivel { font-size: 0.82rem; color: var(--ink-soft); }

        .riesgo {
          border-left: 3px solid var(--brick);
          padding: 6px 0 6px 12px;
          margin-bottom: 12px;
        }
        .riesgo:last-child { margin-bottom: 0; }
        .riesgo-titulo { font-weight: 500; font-size: 0.92rem; }
        .riesgo-detalle { color: var(--ink-soft); font-size: 0.85rem; margin-top: 2px; }

        ol.recomendaciones { margin: 0; padding-left: 20px; }
        ol.recomendaciones li { font-size: 0.9rem; margin-bottom: 10px; line-height: 1.45; }
        ol.recomendaciones li:last-child { margin-bottom: 0; }

        .form-inline {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
          align-items: end;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--line);
          margin-bottom: 16px;
        }
        .campo { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; }
        .campo-label { color: var(--ink-soft); }
        .campo input, .campo select {
          font-family: inherit;
          font-size: 0.9rem;
          padding: 7px 8px;
          border: 1px solid var(--line);
          border-radius: 2px;
          background: var(--paper-raised);
          color: var(--ink);
        }
        .campo input:focus, .campo select:focus { outline: 2px solid var(--teal); outline-offset: 1px; }

        .btn {
          font-family: inherit;
          font-size: 0.85rem;
          padding: 8px 14px;
          border-radius: 2px;
          border: 1px solid var(--ink);
          background: var(--ink);
          color: var(--paper);
          cursor: pointer;
        }
        .btn:hover { background: #34443E; }
        .btn.secundario { background: transparent; color: var(--ink); }
        .btn.secundario:hover { background: var(--paper-raised); }
        .btn.fantasma { background: none; border: none; color: var(--ink-soft); text-decoration: underline; padding: 4px 0; }

        .lista-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px dotted var(--line);
          font-size: 0.88rem;
        }
        .lista-item:last-child { border-bottom: none; }
        .lista-item .nombre { flex: 1; }
        .lista-item .detalle { color: var(--ink-soft); font-size: 0.8rem; }
        .lista-item .monto { font-variant-numeric: tabular-nums; white-space: nowrap; }

        .btn-icono {
          background: none;
          border: none;
          color: var(--ink-soft);
          cursor: pointer;
          padding: 4px;
          display: flex;
        }
        .btn-icono:hover { color: var(--brick); }

        .vacio {
          text-align: center;
          padding: 40px 20px;
        }
        .vacio p { color: var(--ink-soft); max-width: 44ch; margin: 8px auto 20px; }
        .vacio-acciones { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

        .progreso-pista {
          height: 7px;
          background: var(--paper-raised);
          border-radius: 2px;
          overflow: hidden;
          margin: 6px 0 4px;
        }
        .progreso-relleno { height: 100%; background: var(--teal); }

        .pie {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 26px;
          font-size: 0.78rem;
          color: var(--ink-soft);
        }

        @media (max-width: 560px) {
          .grid-salud { grid-template-columns: 1fr; }
          nav.tabs button span.texto-tab { display: none; }
        }
      `}</style>

      <header className="encabezado">
        <h1>Copiloto financiero</h1>
        <p>
          Registra tus ingresos, gastos, deudas y ahorros. El copiloto calcula cuánto puedes gastar de verdad, qué
          riesgos corres y qué hacer primero para mejorar tu salud financiera.
        </p>
      </header>

      <nav className="tabs">
        {TABS.map((t) => {
          const Icono = t.icon;
          return (
            <button key={t.id} className={tab === t.id ? "activo" : ""} onClick={() => setTab(t.id)}>
              <Icono size={15} />
              <span className="texto-tab">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {!hayDatos ? (
        <div className="bloque vacio">
          <h2>Tu copiloto todavía no tiene con qué trabajar</h2>
          <p>Agrega tus ingresos y gastos reales, o carga un ejemplo boliviano para explorar cómo funciona.</p>
          <div className="vacio-acciones">
            <button className="btn" onClick={() => setTab("flujo")}>
              Agregar mis datos
            </button>
            <button className="btn secundario" onClick={cargarEjemplo}>
              <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Cargar ejemplo
            </button>
          </div>
        </div>
      ) : (
        <>
          {tab === "resumen" && <PanelResumen diag={diag} setTab={setTab} />}
          {tab === "flujo" && <PanelFlujo perfil={perfil} setPerfil={setPerfil} />}
          {tab === "deudas" && <PanelDeudas perfil={perfil} setPerfil={setPerfil} />}
          {tab === "ahorro" && <PanelAhorro perfil={perfil} setPerfil={setPerfil} diag={diag} />}
          {tab === "diagnostico" && <PanelDiagnostico diag={diag} />}
        </>
      )}

      <div className="pie">
        <span>{estadoGuardado}</span>
        <div style={{ display: "flex", gap: 14 }}>
          {hayDatos && (
            <button className="btn fantasma" onClick={cargarEjemplo}>
              Cargar ejemplo
            </button>
          )}
          {hayDatos && (
            <button className="btn fantasma" onClick={borrarTodo}>
              <RotateCcw size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
              Borrar todo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Resumen
// ---------------------------------------------------------------------------
function PanelResumen({ diag, setTab }) {
  const libreNegativo = diag.libreReal < 0;
  return (
    <section className="panel">
      <div className="bloque">
        <h3>Puedes gastar libremente este mes</h3>
        <div className={`hero-numero ${libreNegativo ? "hero-negativo" : ""}`}>{fmtBs(diag.libreReal)}</div>
        <div className="hero-etiqueta">
          Después de gastos fijos, cuotas de deuda, gastos variables y un ahorro recomendado del 15%.
        </div>
        <div style={{ marginTop: 16 }}>
          <FilaLibro etiqueta="Ingreso mensual" valor={fmtBs(diag.ingresoMensual)} />
          <FilaLibro etiqueta="Gastos fijos" valor={`− ${fmtBs(diag.gastosFijos)}`} />
          <FilaLibro etiqueta="Cuotas de deuda" valor={`− ${fmtBs(diag.cuotasDeuda)}`} />
          <FilaLibro etiqueta="Gastos variables" valor={`− ${fmtBs(diag.gastosVariables)}`} />
          <FilaLibro etiqueta="Ahorro recomendado (15%)" valor={`− ${fmtBs(diag.ahorroRecomendado)}`} />
          <FilaLibro etiqueta="Disponible real" valor={fmtBs(diag.libreReal)} fuerte />
        </div>
      </div>

      <div className="bloque">
        <h2>Salud financiera</h2>
        <div className="grid-salud">
          <div className="salud-numero" style={{ color: colorSalud(diag.puntajeSalud) }}>
            {diag.puntajeSalud}
          </div>
          <BarraSalud puntaje={diag.puntajeSalud} />
          <div className="salud-nivel">{diag.nivelSalud}</div>
        </div>
      </div>

      <div className="bloque">
        <h2>Riesgos detectados</h2>
        {diag.riesgos.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
            No se detectan riesgos importantes con los datos actuales.
          </p>
        ) : (
          diag.riesgos.slice(0, 3).map((r, i) => <TarjetaRiesgo key={i} riesgo={r} />)
        )}
        {diag.riesgos.length > 3 && (
          <button className="btn fantasma" onClick={() => setTab("diagnostico")}>
            Ver los {diag.riesgos.length} riesgos
          </button>
        )}
      </div>

      <div className="bloque">
        <h2>Qué hacer primero</h2>
        {diag.recomendaciones.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
            Vas bien encaminado. Sigue registrando tus movimientos para afinar las recomendaciones.
          </p>
        ) : (
          <ol className="recomendaciones">
            {diag.recomendaciones.slice(0, 3).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel: Ingresos y gastos
// ---------------------------------------------------------------------------
function PanelFlujo({ perfil, setPerfil }) {
  const [ni, setNi] = useState({ fuente: "", monto: "", frecuencia: "mensual" });
  const [ng, setNg] = useState({ categoria: CATEGORIAS_GASTO[0], monto: "", tipo: "fijo" });

  function agregarIngreso() {
    if (!ni.fuente || !n(ni.monto)) return;
    setPerfil((p) => ({ ...p, ingresos: [...p.ingresos, { id: uid("i"), ...ni, monto: n(ni.monto) }] }));
    setNi({ fuente: "", monto: "", frecuencia: "mensual" });
  }
  function agregarGasto() {
    if (!n(ng.monto)) return;
    setPerfil((p) => ({ ...p, gastos: [...p.gastos, { id: uid("g"), ...ng, monto: n(ng.monto) }] }));
    setNg({ categoria: CATEGORIAS_GASTO[0], monto: "", tipo: "fijo" });
  }
  function quitar(coleccion, id) {
    setPerfil((p) => ({ ...p, [coleccion]: p[coleccion].filter((x) => x.id !== id) }));
  }

  return (
    <section className="panel">
      <div className="bloque">
        <h2>Ingresos</h2>
        <div className="form-inline">
          <Campo label="Fuente">
            <input value={ni.fuente} onChange={(e) => setNi({ ...ni, fuente: e.target.value })} placeholder="Ej. sueldo" />
          </Campo>
          <Campo label="Monto (Bs)">
            <input type="number" value={ni.monto} onChange={(e) => setNi({ ...ni, monto: e.target.value })} placeholder="0" />
          </Campo>
          <Campo label="Frecuencia">
            <select value={ni.frecuencia} onChange={(e) => setNi({ ...ni, frecuencia: e.target.value })}>
              {FRECUENCIAS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Campo>
          <button className="btn" onClick={agregarIngreso}>
            Agregar
          </button>
        </div>
        {perfil.ingresos.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem" }}>Aún no agregaste ingresos.</p>
        ) : (
          perfil.ingresos.map((i) => (
            <div className="lista-item" key={i.id}>
              <span className="nombre">{i.fuente}</span>
              <span className="detalle">{FRECUENCIAS.find((f) => f.value === i.frecuencia)?.label}</span>
              <span className="monto">{fmtBs(i.monto)}</span>
              <BotonEliminar onClick={() => quitar("ingresos", i.id)} />
            </div>
          ))
        )}
      </div>

      <div className="bloque">
        <h2>Gastos mensuales</h2>
        <div className="form-inline">
          <Campo label="Categoría">
            <select value={ng.categoria} onChange={(e) => setNg({ ...ng, categoria: e.target.value })}>
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Monto (Bs)">
            <input type="number" value={ng.monto} onChange={(e) => setNg({ ...ng, monto: e.target.value })} placeholder="0" />
          </Campo>
          <Campo label="Tipo">
            <select value={ng.tipo} onChange={(e) => setNg({ ...ng, tipo: e.target.value })}>
              <option value="fijo">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </Campo>
          <button className="btn" onClick={agregarGasto}>
            Agregar
          </button>
        </div>
        {perfil.gastos.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem" }}>Aún no agregaste gastos.</p>
        ) : (
          perfil.gastos.map((g) => (
            <div className="lista-item" key={g.id}>
              <span className="nombre">{g.categoria}</span>
              <span className="detalle">{g.tipo === "fijo" ? "Fijo" : "Variable"}</span>
              <span className="monto">{fmtBs(g.monto)}</span>
              <BotonEliminar onClick={() => quitar("gastos", g.id)} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel: Deudas
// ---------------------------------------------------------------------------
function PanelDeudas({ perfil, setPerfil }) {
  const [nd, setNd] = useState({ nombre: "", tipo: "tarjeta_credito", saldo: "", tasaAnual: "", cuota: "" });

  function agregar() {
    if (!nd.nombre || !n(nd.cuota)) return;
    setPerfil((p) => ({
      ...p,
      deudas: [
        ...p.deudas,
        { id: uid("d"), ...nd, saldo: n(nd.saldo), tasaAnual: n(nd.tasaAnual), cuota: n(nd.cuota) },
      ],
    }));
    setNd({ nombre: "", tipo: "tarjeta_credito", saldo: "", tasaAnual: "", cuota: "" });
  }
  function quitar(id) {
    setPerfil((p) => ({ ...p, deudas: p.deudas.filter((x) => x.id !== id) }));
  }

  return (
    <section className="panel">
      <div className="bloque">
        <h2>Deudas activas</h2>
        <div className="form-inline">
          <Campo label="Nombre / acreedor">
            <input value={nd.nombre} onChange={(e) => setNd({ ...nd, nombre: e.target.value })} placeholder="Ej. tarjeta BNB" />
          </Campo>
          <Campo label="Tipo">
            <select value={nd.tipo} onChange={(e) => setNd({ ...nd, tipo: e.target.value })}>
              {TIPOS_DEUDA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Saldo actual (Bs)">
            <input type="number" value={nd.saldo} onChange={(e) => setNd({ ...nd, saldo: e.target.value })} placeholder="0" />
          </Campo>
          <Campo label="Tasa anual (%)">
            <input type="number" value={nd.tasaAnual} onChange={(e) => setNd({ ...nd, tasaAnual: e.target.value })} placeholder="0" />
          </Campo>
          <Campo label="Cuota mensual (Bs)">
            <input type="number" value={nd.cuota} onChange={(e) => setNd({ ...nd, cuota: e.target.value })} placeholder="0" />
          </Campo>
          <button className="btn" onClick={agregar}>
            Agregar
          </button>
        </div>
        {perfil.deudas.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem" }}>Aún no registraste deudas.</p>
        ) : (
          perfil.deudas.map((d) => (
            <div className="lista-item" key={d.id}>
              <span className="nombre">{d.nombre}</span>
              <span className="detalle">
                {TIPOS_DEUDA.find((t) => t.value === d.tipo)?.label} · {d.tasaAnual}% anual · saldo {fmtBs(d.saldo)}
              </span>
              <span className="monto">{fmtBs(d.cuota)}/mes</span>
              <BotonEliminar onClick={() => quitar(d.id)} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel: Ahorro y metas
// ---------------------------------------------------------------------------
function PanelAhorro({ perfil, setPerfil, diag }) {
  const [na, setNa] = useState({ nombre: "", tipo: "efectivo", monto: "" });
  const [nm, setNm] = useState({ nombre: "", objetivo: "", actual: "", plazoMeses: "" });

  function agregarAhorro() {
    if (!n(na.monto)) return;
    setPerfil((p) => ({ ...p, ahorros: [...p.ahorros, { id: uid("a"), ...na, monto: n(na.monto) }] }));
    setNa({ nombre: "", tipo: "efectivo", monto: "" });
  }
  function agregarMeta() {
    if (!nm.nombre || !n(nm.objetivo)) return;
    setPerfil((p) => ({
      ...p,
      metas: [
        ...p.metas,
        { id: uid("m"), ...nm, objetivo: n(nm.objetivo), actual: n(nm.actual), plazoMeses: n(nm.plazoMeses) },
      ],
    }));
    setNm({ nombre: "", objetivo: "", actual: "", plazoMeses: "" });
  }
  function quitar(coleccion, id) {
    setPerfil((p) => ({ ...p, [coleccion]: p[coleccion].filter((x) => x.id !== id) }));
  }

  return (
    <section className="panel">
      <div className="bloque">
        <h2>Ahorros</h2>
        <div className="form-inline">
          <Campo label="Nombre">
            <input value={na.nombre} onChange={(e) => setNa({ ...na, nombre: e.target.value })} placeholder="Ej. caja de ahorro" />
          </Campo>
          <Campo label="Tipo">
            <select value={na.tipo} onChange={(e) => setNa({ ...na, tipo: e.target.value })}>
              {TIPOS_AHORRO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Monto (Bs)">
            <input type="number" value={na.monto} onChange={(e) => setNa({ ...na, monto: e.target.value })} placeholder="0" />
          </Campo>
          <button className="btn" onClick={agregarAhorro}>
            Agregar
          </button>
        </div>
        {perfil.ahorros.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem" }}>Aún no registraste ahorros.</p>
        ) : (
          perfil.ahorros.map((a) => (
            <div className="lista-item" key={a.id}>
              <span className="nombre">{a.nombre || "Ahorro"}</span>
              <span className="detalle">{TIPOS_AHORRO.find((t) => t.value === a.tipo)?.label}</span>
              <span className="monto">{fmtBs(a.monto)}</span>
              <BotonEliminar onClick={() => quitar("ahorros", a.id)} />
            </div>
          ))
        )}
      </div>

      <div className="bloque">
        <h2>Metas</h2>
        <div className="form-inline">
          <Campo label="Nombre de la meta">
            <input value={nm.nombre} onChange={(e) => setNm({ ...nm, nombre: e.target.value })} placeholder="Ej. inicial de moto" />
          </Campo>
          <Campo label="Objetivo (Bs)">
            <input type="number" value={nm.objetivo} onChange={(e) => setNm({ ...nm, objetivo: e.target.value })} placeholder="0" />
          </Campo>
          <Campo label="Ya tienes (Bs)">
            <input type="number" value={nm.actual} onChange={(e) => setNm({ ...nm, actual: e.target.value })} placeholder="0" />
          </Campo>
          <Campo label="Plazo (meses)">
            <input type="number" value={nm.plazoMeses} onChange={(e) => setNm({ ...nm, plazoMeses: e.target.value })} placeholder="opcional" />
          </Campo>
          <button className="btn" onClick={agregarMeta}>
            Agregar
          </button>
        </div>
        {diag.metasCalculadas.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem" }}>Aún no definiste metas.</p>
        ) : (
          diag.metasCalculadas.map((m) => {
            const progreso = m.objetivo > 0 ? clamp((m.actual / m.objetivo) * 100, 0, 100) : 0;
            return (
              <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px dotted var(--line)" }}>
                <div className="lista-item" style={{ borderBottom: "none", padding: 0 }}>
                  <span className="nombre">{m.nombre}</span>
                  <span className="monto">
                    {fmtBs(m.actual)} / {fmtBs(m.objetivo)}
                  </span>
                  <BotonEliminar onClick={() => quitar("metas", m.id)} />
                </div>
                <div className="progreso-pista">
                  <div className="progreso-relleno" style={{ width: `${progreso}%` }} />
                </div>
                <div className="detalle">
                  {m.mesesAlRitmoActual === Infinity
                    ? "A tu ritmo de ahorro actual, todavía no la alcanzarías."
                    : `A tu ritmo actual, la alcanzas en ${m.mesesAlRitmoActual} meses.`}
                  {m.plazoMeses > 0 && (
                    <> {m.alcanzableEnPlazo ? "El plazo que pusiste es realista." : "El plazo que pusiste no es realista con tu disponible actual."}</>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel: Diagnóstico completo
// ---------------------------------------------------------------------------
function PanelDiagnostico({ diag }) {
  const filas = [
    { k: "puntoAhorro", max: 30, label: "Tasa de ahorro" },
    { k: "puntoDti", max: 25, label: "Nivel de endeudamiento" },
    { k: "puntoFondo", max: 25, label: "Fondo de emergencia" },
    { k: "puntoDeudaCara", max: 20, label: "Deuda cara / informal" },
  ];
  return (
    <section className="panel">
      <div className="bloque">
        <h2>Composición del puntaje ({diag.puntajeSalud}/100 · {diag.nivelSalud})</h2>
        {filas.map((f) => (
          <div key={f.k} style={{ marginBottom: 10 }}>
            <FilaLibro
              etiqueta={f.label}
              valor={`${Math.round(diag.desglosePuntaje[f.k])} / ${f.max}`}
            />
            <div className="barra-salud-pista">
              <div
                className="barra-salud-relleno"
                style={{
                  width: `${(diag.desglosePuntaje[f.k] / f.max) * 100}%`,
                  background: "var(--teal)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bloque">
        <h2>Indicadores</h2>
        <FilaLibro etiqueta="Relación deuda / ingreso (DTI)" valor={pct(diag.dti)} />
        <FilaLibro etiqueta="Tasa de ahorro" valor={pct(diag.tasaAhorro)} />
        <FilaLibro etiqueta="Fondo de emergencia" valor={`${diag.fondoEmergenciaMeses.toFixed(1)} meses`} />
        <FilaLibro etiqueta="Saldo total de deuda" valor={fmtBs(diag.saldoDeudaTotal)} />
        <FilaLibro etiqueta="Ahorro total" valor={fmtBs(diag.ahorroTotal)} />
      </div>

      <div className="bloque">
        <h2>Todos los riesgos ({diag.riesgos.length})</h2>
        {diag.riesgos.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>No se detectan riesgos importantes.</p>
        ) : (
          diag.riesgos.map((r, i) => <TarjetaRiesgo key={i} riesgo={r} />)
        )}
      </div>

      <div className="bloque">
        <h2>Todas las recomendaciones</h2>
        {diag.recomendaciones.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>Nada urgente por ahora.</p>
        ) : (
          <ol className="recomendaciones">
            {diag.recomendaciones.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
