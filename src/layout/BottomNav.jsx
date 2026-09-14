import React from "react";
import { NavLink } from "react-router-dom";
import { MAIN_NAV } from "./navConfig.js";

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-paper border-t border-line flex justify-around py-1.5 z-40">
      {MAIN_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-[0.65rem] ${isActive ? "text-teal" : "text-ink-soft"}`
          }
        >
          <Icon size={19} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

