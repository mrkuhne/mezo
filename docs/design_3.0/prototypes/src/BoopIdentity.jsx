import React, { useEffect, useRef, useState } from "react";
import { Avatar } from "./shared.jsx";
import definition from "./avatar-definition.json";
import { boopIconPaths } from "./boop-icon-paths.mjs";

export function BoopIcon({ name, size = 20, ...props }) {
  return <svg className="boop-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {(boopIconPaths[name] || boopIconPaths.sparkles).map((d, i) => <path key={i} d={d} />)}
  </svg>;
}
export function BoopAvatar({ size = 120, state = "idle" }) {
  return <span className="boop-avatar" style={{ width: size, height: size }}>
    <Avatar size={size} state={state} avatarDefinition={definition} name="Boop" />
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
    </button>
    <span className="boop-status" role="status"><i />{happy ? "Boop! Ez jólesett." : "Itt vagyok veled"}</span>
  </div>;
}
