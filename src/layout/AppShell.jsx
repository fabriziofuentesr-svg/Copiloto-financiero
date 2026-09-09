import React from "react";
import { Outlet, Link } from "react-router-dom";
import { Settings } from "lucide-react";
import { Sidebar } from "./Sidebar.jsx";
import { BottomNav } from "./BottomNav.jsx";

export function AppShell() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="font-display font-semibold">Copiloto Financiero</div>
          <Link to="/configuracion" className="text-ink-soft" aria-label="Configuración">
            <Settings size={19} />
          </Link>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-20 md:pb-8 max-w-5xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
