import { cn } from '@/lib/utils';

type MetricTileProps = {
  label: string;
  value: string;
  className?: string;
};

export function MetricTile({ label, value, className }: MetricTileProps) {
  return <div className={cn('flex min-h-[64px] items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-3', className)}><p className="text-sm text-muted-foreground">{label}</p><p className="text-base font-semibold">{value}</p></div>;
}
