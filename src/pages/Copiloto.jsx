import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { useFinanceState } from "../context/FinanceContext.jsx";
import { Card, Input, Button } from "../components/ui/primitives.jsx";
import { answerQuestion } from "../services/financial/copilotEngine.js";
import { SectionGuide } from "../components/SectionGuide.jsx";

const SUGERENCIAS = [
  "¿Puedo comprar un celular de Bs 3.500?",
  "¿Cuánto puedo ahorrar este mes?",
  "¿Por qué gasté más este mes?",
  "¿Cómo puedo llegar antes a mi objetivo?",
  "¿Qué deuda debería priorizar?",
  "¿Cuánto dinero realmente tengo disponible?",
];

export default function Copiloto() {
  const state = useFinanceState();
  const [messages, setMessages] = useState([
    { role: "bot", text: `Hola, ${state.profile.name}. Soy tu copiloto financiero. Preguntame lo que quieras sobre tu dinero.` },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function enviar(text) {
    const q = (text ?? input).trim();
    if (!q) return;
    const respuesta = answerQuestion(state, q);
    setMessages((m) => [...m, { role: "user", text: q }, { role: "bot", text: respuesta }]);
    setInput("");
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-9rem)] md:h-[calc(100vh-6rem)]">
      <h1 className="font-display text-2xl font-semibold">Copiloto</h1>

      <Card className="flex-1 flex flex-col overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "bot" && <Bot size={18} className="text-teal shrink-0 mt-1" />}
              <div className={`max-w-[80%] text-sm rounded px-3 py-2 ${m.role === "user" ? "bg-ink text-paper" : "bg-paper-raised"}`}>
                {m.text}
              </div>
              {m.role === "user" && <User size={18} className="text-ink-soft shrink-0 mt-1" />}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {SUGERENCIAS.map((s) => (
              <button key={s} onClick={() => enviar(s)} className="text-xs border border-line rounded px-2.5 py-1.5 hover:bg-paper-raised">
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="flex gap-2 p-3 border-t border-line"
        >
          <Input className="flex-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Preguntale algo a tu copiloto..." />
          <Button type="submit" size="md">
            <Send size={15} />
          </Button>
        </form>
      </Card>

      <p className="text-ink-soft text-xs">
        Estas respuestas se generan con reglas sobre tus datos reales, todavía sin un modelo de IA conectado. La
        arquitectura (services/financial/copilotEngine.js) está lista para enchufar un modelo real más adelante.
      </p>
      <SectionGuide section="copilot" />
    </div>
  );
}
