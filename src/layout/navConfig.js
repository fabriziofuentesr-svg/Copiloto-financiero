import { Home, ArrowLeftRight, Target, BarChart3, Bot, Wallet, Settings } from "lucide-react";

export const MAIN_NAV = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { to: "/mi-mes", label: "Mi mes", icon: BarChart3 },
  { to: "/planes-ahorro", label: "Planes de Ahorro", icon: Target },
  { to: "/copiloto", label: "Copiloto", icon: Bot },
];

export const SECONDARY_NAV = [
  { to: "/cuentas", label: "Cuentas", icon: Wallet },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];
