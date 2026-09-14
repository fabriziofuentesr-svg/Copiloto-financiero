import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export function Card({ children, className = "", title, action }) {
  return (
    <div className={`bg-paper border border-line rounded p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="font-display font-semibold text-[1.05rem]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "text-xs px-2.5 py-1.5", md: "text-sm px-4 py-2", lg: "text-base px-5 py-2.5" };
  const variants = {
    primary: "bg-ink text-paper hover:bg-[#34443E]",
    secondary: "bg-transparent text-ink border border-ink hover:bg-paper-raised",
    ghost: "bg-transparent text-ink-soft hover:text-ink underline",
    danger: "bg-brick text-paper hover:bg-[#8E3325]",
  };
  return (
    <button type={props.type || "button"} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
    dialog?.querySelector("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])")?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = [...(dialog?.querySelectorAll(focusableSelector) || [])];
        if (!items.length) return;
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-paper w-full sm:max-w-lg sm:rounded border border-line max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-paper">
          <h2 id={titleId} className="font-display font-semibold text-[1.05rem]">{title}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label={`Cerrar ${title}`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-soft text-xs">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "font-sans text-sm px-3 py-2 border border-line rounded bg-paper-raised text-ink focus:outline-none focus:ring-2 focus:ring-teal";

export function Input({ className = "", ...props }) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ children, className = "", ...props }) {
  return (
    <select className={`${inputClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function ProgressBar({ value, max = 100, color = "#1F5C56", trackClassName = "" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`h-2 bg-paper-raised rounded overflow-hidden ${trackClassName}`}>
      <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const badgeStyles = {
  danger: "bg-brick/10 text-brick",
  warning: "bg-ochre/15 text-[#8A5F1E]",
  positive: "bg-teal/10 text-teal",
  neutral: "bg-paper-raised text-ink-soft",
};

export function Badge({ level = "neutral", children }) {
  return <span className={`inline-block text-xs px-2 py-1 rounded ${badgeStyles[level]}`}>{children}</span>;
}
