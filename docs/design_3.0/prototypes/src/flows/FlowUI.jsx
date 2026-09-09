import React, { useContext } from "react";
import { Avatar, Icon, IdentityContext } from "../shared.jsx";
import "./flow-ui.css";
export function FlowHead({ eyebrow, title, description, children }) {
  const identity = useContext(IdentityContext);
  if (identity?.pageTitle) {
    title = identity.pageTitle;
    eyebrow = null;
  }
  return (
    <div className="flow-head">
      {eyebrow && <span className="flow-kicker">{eyebrow}</span>}
      <h1 className="flow-title">
        {typeof title === "string"
          ? title.split("<br/>").map((t, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {t}
              </React.Fragment>
            ))
          : title}
      </h1>
      {description && <p className="flow-copy">{description}</p>}
      {children}
    </div>
  );
}
export function FlowTabs({ items, value, onChange }) {
  return (
    <div className="flow-tabs" role="group" aria-label="Nézet választása">
      {items.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          className={value === id ? "selected" : ""}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function FlowRow({ icon, title, subtitle, value, onClick, children }) {
  const C = onClick ? "button" : "div";
  return (
    <C
      className="flow-row"
      onClick={onClick}
      {...(onClick ? { type: "button" } : {})}
    >
      {icon && (
        <span className="flow-row-icon">
          <Icon name={icon} />
        </span>
      )}
      <span className="flow-row-copy">
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
        {children}
      </span>
      {value !== undefined && <span className="flow-row-value">{value}</span>}
      {onClick && <Icon name="chevron-right" size={16} />}
    </C>
  );
}
export function CompanionNote({ children, action, onClick, state = "idle" }) {
  const identity = useContext(IdentityContext);
  return (
    <div className="flow-companion">
      {identity?.visual === "rpg" ? (
        <span className="rpg-note-icon">
          <Icon name="info" />
        </span>
      ) : (
        <Avatar size={48} state={state} />
      )}
      <div>
        <span className="flow-kicker">
          {identity?.visual === "rpg"
            ? "ADAT ÉS KONTEXTUS"
            : identity?.name || "MEZO"}
        </span>
        <div className="flow-companion-copy">{children}</div>
        {action && (
          <button type="button" className="text-button" onClick={onClick}>
            {action}
            <Icon name="arrow-right" size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
export function EmptyState({
  icon = "search",
  title,
  description,
  action,
  onClick,
}) {
  return (
    <div className="flow-empty">
      <Icon name={icon} size={30} />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && (
        <button type="button" className="secondary-button" onClick={onClick}>
          {action}
        </button>
      )}
    </div>
  );
}
