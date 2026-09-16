import React from "react";
import { NavLink } from "react-router-dom";
import { MAIN_NAV } from "./navConfig.js";

export function BottomNav() {
  return (
    <nav aria-label="Navegación principal" className="md:hidden fixed bottom-0 inset-x-0 bg-paper border-t border-line flex py-1.5 z-40 overflow-hidden">
      {MAIN_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 min-w-0 flex-col items-center gap-0.5 px-0.5 py-1 text-[0.62rem] ${isActive ? "text-teal" : "text-ink-soft"}`
          }
        >
          <Icon size={19} aria-hidden="true" />
          <span className="w-full text-center leading-tight whitespace-normal">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
