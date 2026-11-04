/** Numbered section heading shared by the calendar's forms. */
export function StepLabel({ n, label, optional }: { n: number; label: string; optional?: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] tabular-nums text-foreground">
        {n}
      </span>
      {label}
      {optional && <span className="font-normal normal-case tracking-normal">({optional})</span>}
    </h3>
  );
}
