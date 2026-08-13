import { Card, CardContent } from "@/components/core/ui/card";
import { cn } from "@/lib/utils";

interface RevenueMetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function RevenueMetricCard({
  label,
  value,
  subtitle,
  icon,
  className,
}: RevenueMetricCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon && (
            <div className="text-muted-foreground/60">{icon}</div>
          )}
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
