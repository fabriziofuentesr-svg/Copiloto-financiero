import React from "react";

function colorFor(score) {
  if (score <= 40) return "#A63D2C";
  if (score <= 60) return "#C1892E";
  if (score <= 80) return "#5C8A72";
  return "#1F5C56";
}

function levelFor(score) {
  if (score <= 40) return "Crítica";
  if (score <= 60) return "Débil";
  if (score <= 80) return "Estable";
  return "Sólida";
}

export function FinancialScoreGauge({ score, size = 96 }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = colorFor(score);

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#EAE5D4" strokeWidth="10" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text x="50%" y="52%" textAnchor="middle" fontSize="22" fontFamily="Lora, serif" fontWeight="600" fill="#22302C">
          {score}
        </text>
      </svg>
      <div>
        <div className="font-display font-semibold" style={{ color }}>
          {levelFor(score)}
        </div>
        <div className="text-ink-soft text-xs">Salud financiera</div>
      </div>
    </div>
  );
}
