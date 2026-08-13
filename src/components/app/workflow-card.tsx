import Link from "next/link";
import { Card, CardContent } from "@/components/core/ui/card";
import { Lock } from "lucide-react";

interface WorkflowCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  enabled?: boolean;
}

export function WorkflowCard({ icon, title, description, href, enabled = false }: WorkflowCardProps) {
  const content = (
    <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center h-14 w-14 rounded-lg bg-secondary text-secondary-foreground">
            {icon}
          </div>
          {!enabled && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              <Lock className="h-3 w-3" />
              <span>Coming soon</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </CardContent>
  );

  if (enabled && href) {
    return (
      <Link href={href} className="block rounded-lg transition-transform hover:-translate-y-0.5">
        <Card className="h-full">{content}</Card>
      </Link>
    );
  }

  return <Card className="opacity-70 cursor-not-allowed select-none h-full">{content}</Card>;
}
