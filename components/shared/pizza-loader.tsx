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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-muted-foreground" />
    </div>
  );
}
