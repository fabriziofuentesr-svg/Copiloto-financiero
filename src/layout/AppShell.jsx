import React from "react";
import { Outlet, Link } from "react-router-dom";
import { Settings } from "lucide-react";
import { Sidebar } from "./Sidebar.jsx";
import { BottomNav } from "./BottomNav.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export function AppShell() {
  const auth = useAuth();
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-line">
          <div><div className="font-display font-semibold">Copiloto Financiero</div>{auth.status === "guest" ? <div className="text-[11px] text-ochre">Modo invitado</div> : null}</div>
          <Link to="/configuracion" className="text-ink-soft" aria-label="Configuración">
            <Settings size={19} />
          </Link>
        </header>
        {auth.status === "guest" ? <div className="hidden md:flex items-center justify-center gap-2 border-b border-ochre/20 bg-ochre/10 px-4 py-2 text-xs"><span>Estás usando datos guardados solo en este navegador.</span><Link className="font-medium underline" to="/configuracion">Crear una cuenta</Link></div> : null}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-20 md:pb-8 max-w-5xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
