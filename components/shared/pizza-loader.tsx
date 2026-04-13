type PizzaLoaderProps = {
  className?: string;
  fullScreen?: boolean;
};

export function PizzaLoader({ className = "", fullScreen = true }: PizzaLoaderProps) {
  return (
    <div
      className={[
        fullScreen ? "fixed inset-0 z-50" : "w-full",
        "flex items-center justify-center",
        className,
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 rounded-full border border-orange-500/25" />
          <div className="pizza-loader-orbit absolute inset-1 rounded-full border border-orange-500/20" />

          <div className="pizza-loader-pulse absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="h-14 w-14 text-orange-500"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L3 21H21L12 2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="1.4" fill="currentColor" />
              <circle cx="9" cy="15" r="1.1" fill="currentColor" />
              <circle cx="15" cy="15" r="1.1" fill="currentColor" />
              <path
                d="M4.5 18C4.5 18 8 16.5 12 16.5C16 16.5 19.5 18 19.5 18"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="absolute inset-0 -z-10 rounded-full bg-orange-500/10 blur-2xl" />
        </div>

        <p className="text-xs font-semibold tracking-[0.2em] text-foreground/80 uppercase">
          Loading...
        </p>

        <div className="relative h-0.5 w-28 overflow-hidden rounded bg-foreground/15">
          <div className="pizza-loader-bar absolute inset-y-0 bg-orange-500" />
        </div>

        <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/60 uppercase">
          PNE-FOODS
        </p>
      </div>
    </div>
  );
}
