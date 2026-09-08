import React, { useEffect, useId, useRef, useState } from "react";
import { Avatar as LabAvatar } from "@bible-strong/avatar-react";
import "@bible-strong/avatar-react/styles.css";
import * as L from "lucide-react";
import definition from "./avatar-definition.json";

const icons = {
  sun: L.Sun,
  moon: L.Moon,
  "arrow-right": L.ArrowRight,
  "arrow-up-right": L.ArrowUpRight,
  "arrow-left": L.ArrowLeft,
  plus: L.Plus,
  check: L.Check,
  "chevron-right": L.ChevronRight,
  play: L.Play,
  pause: L.Pause,
  send: L.ArrowUp,
  mic: L.Mic,
  heart: L.Heart,
  sparkles: L.Sparkles,
  dumbbell: L.Dumbbell,
  utensils: L.Utensils,
  droplet: L.Droplet,
  clock: L.Clock,
  flame: L.Flame,
  leaf: L.Leaf,
  activity: L.Activity,
  chart: L.ChartNoAxesCombined,
  book: L.BookOpen,
  settings: L.SlidersHorizontal,
  x: L.X,
  search: L.Search,
  coffee: L.Coffee,
  more: L.Ellipsis,
  headphones: L.Headphones,
  target: L.Target,
  calendar: L.CalendarDays,
  "chevron-down": L.ChevronDown,
  volume: L.Volume2,
  rotate: L.RotateCcw,
  wind: L.Wind,
  zap: L.Zap,
  bell: L.Bell,
  users: L.Users,
  scale: L.Scale,
  camera: L.Camera,
  scan: L.ScanLine,
  box: L.Package,
  chef: L.ChefHat,
  medal: L.Medal,
  run: L.Footprints,
  layers: L.Layers,
  edit: L.Pencil,
  trash: L.Trash2,
  info: L.Info,
  "chevron-left": L.ChevronLeft,
  filter: L.ListFilter,
  image: L.Image,
  video: L.Video,
  lightbulb: L.Lightbulb,
  brain: L.Brain,
  message: L.MessageCircle,
  "check-circle": L.CircleCheck,
};
export function Icon({ name, size = 20, ...props }) {
  const C = icons[name] || L.Sparkles;
  return <C size={size} strokeWidth={1.7} aria-hidden="true" {...props} />;
}
const stateMap = {
  idle: "idle",
  neutral: "idle",
  listening: "listening",
  attentive: "listening",
  thinking: "thinking",
  happy: "happy",
  celebrate: "happy",
  celebrating: "happy",
  sleeping: "sleeping",
  calm: "sleeping",
  sleep: "sleeping",
};
export function Avatar({ state = "idle", size = 120, className = "" }) {
  const id = `clay-${useId().replace(/:/g, "")}`;
  return (
    <span
      className={`clay-avatar ${className}`}
      data-state={state}
      style={{ width: size, height: size, "--clay-fill": `url(#${id})` }}
    >
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        style={{ position: "absolute" }}
      >
        <defs>
          <radialGradient id={id} cx="29%" cy="21%" r="83%">
            <stop offset="0" stopColor="var(--clay-highlight,#ffdfc6)" />
            <stop offset=".25" stopColor="var(--clay-light,#ffb28d)" />
            <stop offset=".64" stopColor="var(--clay-body,#f17b53)" />
            <stop offset="1" stopColor="var(--clay-shadow,#b43d25)" />
          </radialGradient>
        </defs>
      </svg>
      <LabAvatar
        definition={definition}
        animation={stateMap[state] || "idle"}
        size={size}
        ariaLabel={`Mezo Clay — ${state === "thinking" ? "gondolkodik" : state === "listening" ? "figyel" : state === "happy" ? "örül" : state === "sleeping" ? "pihen" : "jelen van"}`}
      />
    </span>
  );
}
export function Sparkline({
  values = [40, 52, 46, 66, 59, 76, 82],
  color = "var(--accent)",
  height = 64,
  fill = false,
}) {
  const id = useId().replace(/:/g, "");
  const min = Math.min(...values) - 8,
    max = Math.max(...values) + 8;
  const points = values
    .map(
      (v, i) =>
        `${8 + (i * 284) / Math.max(1, values.length - 1)},${height - 8 - ((v - min) / (max - min)) * (height - 16)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 300 ${height}`}
      className="sparkline"
      style={{ height }}
      role="img"
      aria-label={`Trend: ${values.join(", ")}`}
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={color} stopOpacity=".2" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <polygon
          points={`8,${height} ${points} 292,${height}`}
          fill={`url(#spark-${id})`}
        />
      )}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle
        cx="292"
        cy={height - 8 - ((values.at(-1) - min) / (max - min)) * (height - 16)}
        r="4"
        fill={color}
      />
    </svg>
  );
}
export function Ring({
  value,
  max = 100,
  size = 100,
  width = 7,
  label,
  color = "var(--accent)",
}) {
  const r = (size - width) / 2,
    c = 2 * Math.PI * r;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={label || `${value} / ${max}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="currentColor"
        opacity=".1"
        strokeWidth={width}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={`${c * Math.max(0, Math.min(1, value / max))} ${c}`}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
export function FoodArt({ kind = "bowl", className = "" }) {
  const id = useId().replace(/:/g, "");
  const oats = kind === "oats",
    salmon = kind === "salmon";
  return (
    <svg
      viewBox="0 0 200 170"
      className={`food-art ${className}`}
      role="img"
      aria-label={
        oats
          ? "Áfonyás zabkása"
          : salmon
            ? "Lazac zöldségekkel"
            : "Friss zöldséges tál"
      }
    >
      <defs>
        <radialGradient id={`plate-${id}`}>
          <stop stopColor="#fffdf3" />
          <stop offset=".8" stopColor="#eae4d6" />
          <stop offset="1" stopColor="#c6bca8" />
        </radialGradient>
        <linearGradient id={`fish-${id}`} x2="1" y2="1">
          <stop stopColor="#ffb387" />
          <stop offset="1" stopColor="#cf6241" />
        </linearGradient>
      </defs>
      <ellipse cx="102" cy="141" rx="67" ry="11" fill="#242219" opacity=".12" />
      <ellipse cx="100" cy="87" rx="80" ry="66" fill={`url(#plate-${id})`} />
      <ellipse
        cx="100"
        cy="84"
        rx="65"
        ry="51"
        fill={oats ? "#cfad7b" : "#7d9561"}
      />
      {oats ? (
        <>
          <ellipse cx="100" cy="84" rx="57" ry="44" fill="#ddc395" />
          {[
            [65, 64],
            [84, 51],
            [95, 70],
            [64, 88],
            [80, 96],
            [107, 50],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="9"
              fill={i % 2 ? "#53607e" : "#374965"}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <ellipse
              key={i}
              cx={116 + i * 4}
              cy={70 + i * 13}
              rx="18"
              ry="8"
              transform={`rotate(-27 ${116 + i * 4} ${70 + i * 13})`}
              fill="#f1dfaa"
              stroke="#c4a471"
            />
          ))}
          <path
            d="M83 117q29-26 54-5"
            fill="none"
            stroke="#ab723e"
            strokeWidth="5"
            strokeDasharray="2 8"
          />
        </>
      ) : (
        <>
          {[
            [51, 66, -20],
            [140, 65, 50],
            [63, 105, -55],
            [125, 111, 40],
            [99, 49, 60],
          ].map(([x, y, rot], i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="18"
              ry="10"
              transform={`rotate(${rot} ${x} ${y})`}
              fill={i % 2 ? "#b5c27e" : "#536f43"}
            />
          ))}
          <path d="M74 57q-25 24-6 52q16 12 39 7l13-27-13-31z" fill="#eee4bd" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M${70 + i * 7} 67l-4 18m4 11l4 10`}
              stroke="#d8cd9e"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
          {salmon ? (
            <g transform="rotate(24 114 88)">
              <rect
                x="92"
                y="52"
                width="48"
                height="68"
                rx="12"
                fill={`url(#fish-${id})`}
              />
              {[0, 1, 2, 3].map((i) => (
                <path
                  key={i}
                  d={`M97 ${65 + i * 13}q20 9 37 0`}
                  stroke="#ffd1ad"
                  fill="none"
                  strokeWidth="3"
                />
              ))}
            </g>
          ) : (
            <>
              {[
                [112, 72],
                [124, 92],
                [99, 103],
              ].map(([x, y], i) => (
                <rect
                  key={i}
                  x={x - 10}
                  y={y - 9}
                  width="24"
                  height="19"
                  rx="6"
                  fill={i % 2 ? "#ca975f" : "#e2b579"}
                  transform={`rotate(25 ${x} ${y})`}
                />
              ))}
            </>
          )}
          <circle cx="66" cy="111" r="10" fill="#ca694e" />
          <circle cx="146" cy="85" r="9" fill="#da8060" />
        </>
      )}
    </svg>
  );
}
export function WorkoutArt({ className = "" }) {
  return (
    <svg
      viewBox="0 0 300 180"
      className={`workout-art ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="weight-metal" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#95938a" />
          <stop offset=".5" stopColor="#3d423d" />
          <stop offset="1" stopColor="#171e1b" />
        </linearGradient>
      </defs>
      <ellipse
        cx="155"
        cy="153"
        rx="92"
        ry="12"
        fill="currentColor"
        opacity=".09"
      />
      <g transform="translate(150 85) rotate(-24)">
        <rect x="-73" y="-8" width="146" height="16" rx="6" fill="#a4a697" />
        <rect
          x="-87"
          y="-36"
          width="33"
          height="72"
          rx="8"
          fill="url(#weight-metal)"
        />
        <rect x="-99" y="-26" width="19" height="52" rx="6" fill="#575e51" />
        <rect
          x="54"
          y="-36"
          width="33"
          height="72"
          rx="8"
          fill="url(#weight-metal)"
        />
        <rect x="80" y="-26" width="19" height="52" rx="6" fill="#575e51" />
        <path
          d="M-44-6v12m12-12v12m12-12v12m12-12v12m12-12v12m12-12v12m12-12v12m12-12v12"
          stroke="#60665c"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
export function Chat({ api }) {
  const [draft, setDraft] = useState("");
  const end = useRef(null);
  useEffect(() => {
    end.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "nearest",
    });
  }, [api.state.messages.length, api.typing]);
  function submit(e) {
    e.preventDefault();
    if (draft.trim() && !api.typing) {
      api.send(draft);
      setDraft("");
    }
  }
  return (
    <div className="chat-page">
      <div className="chat-intro">
        <span className="live-dot" />
        Próba-beszélgetés · előre megírt válaszok
      </div>
      <div className="chat-feed" aria-live="polite">
        {api.state.messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.role}`}>
            {m.role === "assistant" && <Avatar size={34} />}
            <div>
              <p>{m.text}</p>
              {m.actions?.length > 0 && (
                <div className="chat-action-list">
                  {m.actions.map((a) => (
                    <button
                      key={a.page + a.label}
                      onClick={() => api.go(a.page, a.params)}
                    >
                      {a.label}
                      <Icon name="arrow-up-right" size={16} />
                    </button>
                  ))}
                </div>
              )}
              {m.role === "assistant" && (
                <span className="chat-source">
                  <Icon name="sparkles" size={12} />{" "}
                  {m.source || "A napod összefüggései"}
                </span>
              )}
            </div>
          </div>
        ))}
        {api.typing && (
          <div className="chat-message assistant">
            <Avatar state="thinking" size={40} />
            <div className="thinking-dots" aria-label="Mezo gondolkodik">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="chat-bottom">
        <div className="chat-suggestions">
          {[
            "Mit egyek edzés előtt?",
            "Hogy áll a hetem?",
            "Mesélj az alvásomról",
          ].map((s) => (
            <button key={s} disabled={api.typing} onClick={() => api.send(s)}>
              {s}
            </button>
          ))}
        </div>
        <form className="chat-composer" onSubmit={submit}>
          <button
            type="button"
            aria-label="Hangüzenet kipróbálása"
            onClick={() => {
              setDraft("Fáradtnak érzem magam. Mit javasolsz estére?");
              api.toast("Példa hangátirat — a mikrofont nem használjuk");
            }}
          >
            <Icon name="mic" />
          </button>
          <input
            aria-label="Üzenet Mezónak"
            placeholder="Mi jár a fejedben?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
          />
          <button
            type="submit"
            aria-label="Üzenet küldése"
            disabled={!draft.trim() || api.typing}
          >
            <Icon name="send" />
          </button>
        </form>
      </div>
    </div>
  );
}
