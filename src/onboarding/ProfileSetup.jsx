import React, { useState } from "react";
import { Card, Field, Input, Select, Button } from "../components/ui/primitives.jsx";

const EMPLOYMENT_TYPES = [
  { value: "dependiente", label: "Dependiente (sueldo fijo)" },
  { value: "independiente", label: "Independiente" },
  { value: "mixto", label: "Mixto" },
  { value: "otro", label: "Otro" },
];

const CURRENCIES = [
  { value: "BOB", label: "Bolivianos (Bs)" },
  { value: "USD", label: "Dólares (USD)" },
];

// Formulario reutilizado tanto en el onboarding como en Configuración
// (para editar el perfil más adelante).
export function ProfileForm({ initialValues, submitLabel = "Guardar", onSubmit }) {
  const [form, setForm] = useState({
    name: initialValues?.name || "",
    currency: initialValues?.currency || "BOB",
    employmentType: initialValues?.employmentType || "",
    estimatedMonthlyIncome: initialValues?.estimatedMonthlyIncome || "",
  });

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const income = Number(form.estimatedMonthlyIncome);
    onSubmit({
      name: form.name.trim(),
      currency: form.currency,
      employmentType: form.employmentType,
      estimatedMonthlyIncome: Number.isFinite(income) ? Math.max(0, income) : 0,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Nombre">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="¿Cómo te llamas?" required />
      </Field>
      <Field label="Moneda principal">
        <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Situación laboral / fuente principal de ingresos">
        <Select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
          <option value="">Selecciona una opción</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
      </Field>
      <Field label={"Ingreso mensual aproximado (" + (form.currency === "USD" ? "USD" : "Bs") + ")"}>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.estimatedMonthlyIncome}
          onChange={(e) => setForm({ ...form, estimatedMonthlyIncome: e.target.value })}
          placeholder="Ej. 4000"
        />
      </Field>
      <Button type="submit" className="mt-2">{submitLabel}</Button>
    </form>
  );
}

export function ProfileSetup({ initialValues, onBack, onComplete }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md" title="Cuéntanos un poco de ti">
        <p className="text-ink-soft text-sm mb-4">
          Solo lo esencial para empezar. Podrás registrar tus ingresos, gastos, deudas y objetivos con detalle más
          adelante, desde sus propias secciones.
        </p>
        <ProfileForm initialValues={initialValues} submitLabel="Continuar" onSubmit={onComplete} />
        {onBack ? (
          <Button variant="ghost" className="w-full mt-2" onClick={onBack}>Atrás</Button>
        ) : null}
      </Card>
    </div>
  );
}
