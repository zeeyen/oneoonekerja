import type { AdminAction } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ModerationHistoryProps {
  actions: AdminAction[];
  isLoading: boolean;
}

const actionConfig: Record<string, { label: string; icon: typeof ShieldAlert; className: string }> = {
  ban: { label: 'Banned', icon: ShieldAlert, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  extend_ban: { label: 'Ban Extended', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20' },
  unban: { label: 'Unbanned', icon: ShieldCheck, className: 'bg-success/10 text-success border-success/20' },
};

export function ModerationHistory({ actions, isLoading }: ModerationHistoryProps) {
  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader><CardTitle>Moderation History</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Moderation History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <History className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">No moderation actions recorded</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {actions.map((action) => {
                const config = actionConfig[action.action_type] ?? actionConfig.ban;
                const Icon = config.icon;
                return (
                  <div key={action.id} className="flex items-start gap-3 rounded-md border p-3">
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={config.className}>
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(action.created_at), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                      {action.details?.reason && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Reason: {action.details.reason}
                        </p>
                      )}
                      {action.details?.duration && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Duration: {action.details.duration.replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
