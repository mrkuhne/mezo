import React from "react";
import { boopIconPaths } from "./boop-icon-paths.mjs";
const paths = {
  bell: ["M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3ZM10 21h4"],
  medal: [
    "M7 3h4l2 7-4 3-5-10ZM14 3h6l-4 10-4-3Z",
    "M7 16a5 5 0 1 0 10 0 5 5 0 1 0-10 0",
    "M12 13v5M10 15l2-2 2 2",
  ],
  droplet: [
    "M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13Z",
    "M9 15q0 3 3 3",
  ],
  settings: [
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z",
    "M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0",
  ],
  info: ["M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0", "M12 11v6M12 7v1"],
  clock: ["M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0", "M12 6v6l4 2"],
  edit: ["M4 16 16 4l4 4L8 20H4ZM13 7l4 4"],
  trash: ["M4 6h16M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7"],
  search: ["M3 10a7 7 0 1 0 14 0 7 7 0 1 0-14 0M15 15l6 6"],
  trophy: [
    "M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3q0 4 5 4M17 5h4v3q0 4-5 4M12 15v5M8 21h8",
  ],
  camera: ["M3 7h4l2-3h6l2 3h4v13H3ZM8 13a4 4 0 1 0 8 0 4 4 0 1 0-8 0"],
};
export function RpgIcon({ name, size = 20, ...props }) {
  return (
    <svg
      className="boop-icon rpg-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {(paths[name] || boopIconPaths[name] || boopIconPaths.sparkles).map(
        (d, i) => (
          <path key={i} d={d} />
        ),
      )}
    </svg>
  );
}
