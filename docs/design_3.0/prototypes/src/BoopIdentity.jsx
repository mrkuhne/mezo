import React, { useEffect, useRef, useState } from "react";
import { Avatar, Icon } from "./shared.jsx";
import definition from "./avatar-definition.json";
import sprite from "../../../design_2.0/assets/clay-icons.svg?raw";

const boop = { ...definition, name: "Boop", expressions: Object.fromEntries(
  Object.entries(definition.expressions).map(([key, expression]) => [key, {
    ...expression,
    eyes: { ...expression.eyes,
      left: { ...expression.eyes.left, width: expression.eyes.left.width * 1.12 },
      right: { ...expression.eyes.right, width: expression.eyes.right.width * 1.12 },
    },
  }]),
) };
const symbols = { sun: "nap", moon: "alvas", dumbbell: "edzes", utensils: "fuel", heart: "eletjel", sparkles: "mezo", activity: "sport", chart: "minta", book: "tudas", target: "cel", run: "futas", box: "kamra", chef: "recept", layers: "meso", brain: "tudas", users: "emberek", scale: "suly", bell: "ertesites", droplet: "viz", medal: "erme", calendar: "naplo", leaf: "fuel" };
export function BoopSprites() {
  return <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: sprite }} />;
}
export function BoopIcon({ name, size = 20, ...props }) {
  return symbols[name] ? <svg className="boop-icon" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" {...props}><use href={`#i-${symbols[name]}`} /></svg> : <Icon name={name} size={size} {...props} />;
}
export function BoopAvatar({ size = 120, state = "idle" }) {
  return <span className="boop-avatar" data-expression={state} style={{ width: size, height: size }}>
    <Avatar size={size} state={state} avatarDefinition={boop} name="Boop" />
    <svg className="boop-face" viewBox="0 0 100 100" aria-hidden="true">
      <g className="boop-brows" fill="none" stroke="#48302e" strokeWidth="2.3" strokeLinecap="round"><path d="M34 33 Q38 30 42 32" /><path d="M58 32 Q62 30 66 33" /></g>
      <g fill="#dc898b" opacity=".55"><ellipse cx="32" cy="56" rx="5" ry="2.7"/><ellipse cx="68" cy="56" rx="5" ry="2.7"/></g>
      <path className="boop-smile" d="M46 60 Q50 64 54 60" fill="none" stroke="#66443c" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  </span>;
}
export function BoopPet({ state = "idle" }) {
  const [happy, setHappy] = useState(false);
  const timeout = useRef(null);
  useEffect(() => () => clearTimeout(timeout.current), []);
  function touch() {
    clearTimeout(timeout.current);
    setHappy(true);
    timeout.current = setTimeout(() => setHappy(false), 1800);
  }
  return <div className="boop-pet" data-happy={happy}>
    <button className="boop-touch" onClick={touch} aria-label="Boop megsimogatása">
      <BoopAvatar size={144} state={happy ? "happy" : state} />
      <span className="boop-pet-spark" aria-hidden="true">♡</span>
    </button>
    <span className="boop-status" role="status"><i />{happy ? "Boop! Ez jólesett." : "Itt vagyok veled"}</span>
  </div>;
}
