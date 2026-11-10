/**
 * Íconos de trazo dentro del código (REQ-078.14, design §22.3): 24 × 24, trazo 1,75 px,
 * `currentColor`. Decorativos: el texto de al lado dice lo mismo, por eso `aria-hidden`.
 */
const PATHS = {
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  search: "m20 20-4.5-4.5M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z",
  camera: "M4 8h3l1.5-2h7L17 8h3v11H4V8ZM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0",
  scissors:
    "M8.5 8.5 20 20M8.5 15.5 20 4M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  alert:
    "M12 9v4.5M12 17h.01M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z",
  info: "M12 11v5.5M12 7.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  error: "M12 7.5V13M12 16.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  offline:
    "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.6-2.6M19 13a10 10 0 0 0-2.2-1.6M2 9.5a15 15 0 0 1 4.5-2.9M22 9.5A15 15 0 0 0 12 5.5M12 20h.01",
  qr: "M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2",
  calendar: "M4 6.5h16V20H4V6.5ZM4 10.5h16M8.5 3.5v4M15.5 3.5v4",
  home: "M4 11 12 4l8 7v9h-5.5v-5.5h-5V20H4v-9Z",
  list: "M5 7h14M5 12h14M5 17h14",
  users:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8",
  chart: "M4 20h16M7 20v-6M12 20V8M17 20v-9",
  drop: "M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z",
  cash: "M3 7h18v10H3V7ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v.01M18 14v.01",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  pin: "M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  cup: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9ZM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12 3.5v2.5",
  backspace: "M9 5h11v14H9l-6-7 6-7ZM12.5 9.5l5 5M17.5 9.5l-5 5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
