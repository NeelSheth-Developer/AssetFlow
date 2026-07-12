import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * AssetFlow brand mark — uses the official logo asset (public/logo.png,
 * background made transparent so it sits on any surface). The favicon comes
 * from src/app/icon.png (same artwork).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="AssetFlow"
      width={310}
      height={310}
      priority
      className={cn("h-8 w-8 object-contain", className)}
    />
  );
}

/** Previous hand-drawn SVG mark — kept for reference/fallback. */
export function LogoMarkSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="af-hex" x1="16" y1="20" x2="112" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6d6ef7" />
          <stop offset="55%" stopColor="#5865f2" />
          <stop offset="100%" stopColor="#4f7df7" />
        </linearGradient>
        <linearGradient id="af-face-l" x1="36" y1="62" x2="62" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6d6ef7" />
          <stop offset="100%" stopColor="#4468f0" />
        </linearGradient>
        <linearGradient id="af-face-r" x1="66" y1="62" x2="92" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5b8bf7" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="af-check" x1="42" y1="56" x2="86" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5865f2" />
          <stop offset="60%" stopColor="#4f7df7" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Rounded hexagon ring */}
      <path
        d="M64 10
           L107 35
           Q112 38 112 44
           L112 84
           Q112 90 107 93
           L64 118
           Q59 121 54 118
           L21 93
           Q16 90 16 84
           L16 44
           Q16 38 21 35
           L54 10
           Q59 7 64 10 Z"
        stroke="url(#af-hex)"
        strokeWidth="11"
        strokeLinejoin="round"
        fill="white"
        className="dark:fill-slate-950"
      />

      {/* Open cube — left face */}
      <path d="M40 63 L61 74 L61 103 L40 91 Q38 90 38 88 L38 66 Q38 63.5 40 63 Z" fill="url(#af-face-l)" />
      {/* Open cube — right face */}
      <path d="M88 63 L67 74 L67 103 L88 91 Q90 90 90 88 L90 66 Q90 63.5 88 63 Z" fill="url(#af-face-r)" />

      {/* Checkmark flowing into the box (orange tip) */}
      <path
        d="M44 54 L60 64 L84 41"
        stroke="url(#af-check)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  withTagline = false,
}: {
  className?: string;
  markClassName?: string;
  withTagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-bold tracking-tight">
          Asset<span className="text-primary">Flow</span>
        </span>
        {withTagline && (
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground mt-1">
            Track. Manage. Optimize.
          </span>
        )}
      </span>
    </span>
  );
}
