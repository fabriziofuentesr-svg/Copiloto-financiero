import React from "react";
import { NavLink } from "react-router-dom";
import { MAIN_NAV, SECONDARY_NAV } from "./navConfig.js";

function Item({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
          isActive ? "bg-paper-raised text-ink font-medium" : "text-ink-soft hover:text-ink hover:bg-paper-raised/60"
        }`
      }
    >
      <Icon size={17} />
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-line px-3 py-6 gap-6">
      <div className="px-3">
        <div className="font-display font-semibold text-lg leading-tight">Copiloto</div>
        <div className="font-display font-semibold text-lg leading-tight text-teal">Financiero</div>
      </div>
      <nav className="flex flex-col gap-1">
        {MAIN_NAV.map((item) => (
          <Item key={item.to} {...item} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-line">
        {SECONDARY_NAV.map((item) => (
          <Item key={item.to} {...item} />
        ))}
      </div>
    </aside>
  );
}

