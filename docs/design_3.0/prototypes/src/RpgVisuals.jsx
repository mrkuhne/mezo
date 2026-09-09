import React from "react";
import { RpgIcon as BoopIcon } from "./RpgIcon.jsx";
import { RPG_ROLES } from "./rpg-model.mjs";
export function ModuleBadge({ role = "home", size = 44 }) {
  const r = RPG_ROLES[role];
  return (
    <span
      className={`rpg-module rpg-module-${role}`}
      style={{
        width: size,
        height: size,
        "--module-color": r.color,
        "--module-light": r.light,
      }}
    >
      <BoopIcon name={role === "home" ? "layers" : r.icon} size={size * 0.48} />
    </span>
  );
}
export function RankEmblem({ level }) {
  return (
    <div className="rpg-rank-art">
      <svg viewBox="0 0 180 180" aria-hidden="true">
        <ellipse
          className="rpg-orbit"
          cx="90"
          cy="96"
          rx="80"
          ry="43"
          transform="rotate(-30 90 96)"
          fill="none"
          stroke="#a3befc"
          strokeWidth="1"
          strokeDasharray="4 7"
        />
        <path
          d="M90 22 146 54V118L90 151 34 118V54Z"
          fill="#132669"
          stroke="#748dff"
          strokeWidth="2"
        />
        <path d="M90 34 134 60V111L90 137 46 111V60Z" fill="#d6ff69" />
        <path d="M90 34 134 60V111L90 137V34" fill="#baf24c" />
        <path
          d="M69 76 90 63 111 76M69 94 90 81 111 94"
          fill="none"
          stroke="#192742"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="150" cy="50" r="6" fill="#ff9266" />
        <path d="M25 118h12m-6-6v12" stroke="#d6ff69" strokeWidth="3" />
        <circle cx="145" cy="137" r="3" fill="#adc2ff" />
      </svg>
      <span>LVL {level}</span>
    </div>
  );
}
export function DataRing({ value, max, label, size = 160 }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <svg
      className="rpg-data-ring"
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label={label}
    >
      <circle
        cx="80"
        cy="80"
        r="65"
        fill="none"
        stroke="currentColor"
        opacity=".12"
        strokeWidth="13"
      />
      <circle
        cx="80"
        cy="80"
        r="65"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${pct} 100`}
        transform="rotate(-90 80 80)"
      />
      {Array.from({ length: 32 }, (_, i) => (
        <path
          key={i}
          d="M80 3V8"
          transform={`rotate(${i * 11.25} 80 80)`}
          stroke="currentColor"
          opacity={i < pct * 0.32 ? 1 : 0.15}
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
export function MuscleMap({ groups = [] }) {
  const active = (g) => (groups.includes(g) ? "#c6f75a" : "#a3b4e9");
  return (
    <svg
      className="rpg-muscle-map"
      viewBox="0 0 150 245"
      role="img"
      aria-label={`Heti célizmok: ${groups.join(", ")}`}
    >
      <circle cx="75" cy="28" r="18" fill="#a3b4e9" />
      <path
        d="M61 49H89L113 65 122 123 111 130 94 87 94 143 86 215 73 215 75 153 71 153 68 215 55 215 48 143 51 87 36 131 25 124 34 66Z"
        fill="#21386a"
        stroke="#8297cd"
        strokeWidth="1.5"
      />
      <path
        d="M51 64 70 58 71 88 54 91Z M79 58 99 65 96 91 79 88Z"
        fill={active("Mell")}
      />
      <path
        d="M39 70 50 62 48 93 35 98Z M103 63 114 72 116 99 102 93Z"
        fill={active("Váll")}
      />
      <path d="M58 100H70V135H58Z M79 100H91V135H79Z" fill={active("Hát")} />
      <path
        d="M53 147 70 146 66 181 56 181Z M78 146 95 147 90 181 80 181Z"
        fill={active("Láb")}
      />
      <path
        d="M56 188H66L63 214H55Z M80 188H90L88 214H79Z"
        fill={active("Láb")}
      />
      <path d="M24 232H126" stroke="#8297cd" strokeDasharray="2 5" />
    </svg>
  );
}
export function MiniBars({ values, label }) {
  const max = Math.max(1, ...values);
  return (
    <div className="rpg-mini-bars" role="img" aria-label={label}>
      {values.map((n, i) => (
        <span key={i} style={{ height: `${Math.max(8, (n / max) * 100)}%` }} />
      ))}
    </div>
  );
}
