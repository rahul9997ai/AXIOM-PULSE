type IconProps = { size?: number };

export function HomeIcon({ size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 001 1h4v-5.5h2V20h4a1 1 0 001-1v-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusCircleIcon({ size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function GearIcon({ size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5l1 2.3 2.4-.7 1 2.3-1.8 1.7 1.8 1.7-1 2.3-2.4-.7-1 2.3-2-0-1-2.3-2.4.7-1-2.3 1.8-1.7-1.8-1.7 1-2.3 2.4.7 1-2.3z"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownloadIcon({ size = 20 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 4v11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 11 12 15.5 16.5 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function LogOutIcon({ size = 20 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M9 4H6a1 1 0 00-1 1v14a1 1 0 001 1h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8l4 4-4 4M9 12h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShareIcon({ size = 18 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11v8a1 1 0 001 1h10a1 1 0 001-1v-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PinIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 21s7-7.2 7-12a7 7 0 10-14 0c0 4.8 7 12 7 12z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function DollarIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 3v18M16.5 7.5c0-1.9-2-3-4.5-3s-4.5 1.1-4.5 3 2 2.7 4.5 3 4.5 1.1 4.5 3-2 3-4.5 3-4.5-1.1-4.5-3"
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CarIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 15.5l1.4-5.4A2 2 0 017.3 8.6h9.4a2 2 0 011.9 1.5l1.4 5.4"
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2.5" y="15.5" width="19" height="4.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="7" cy="20" r="1.3" fill="currentColor" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 12.3l2.6 2.6L16.2 9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 3.5L22 20.5H2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 9.5v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="17.3" r="1" fill="currentColor" />
    </svg>
  );
}

export function CircleIcon({ size = 15 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
