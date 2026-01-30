import { ReactNode } from 'react';
import { LucideIcon, Users, Briefcase, CheckCircle, FileSearch, MessageSquare, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EmptyStateType = 'users' | 'jobs' | 'handovers' | 'conversations' | 'search' | 'error';

interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: ReactNode;
}

const defaultIcons: Record<EmptyStateType, LucideIcon> = {
  users: Users,
  jobs: Briefcase,
  handovers: CheckCircle,
  conversations: MessageSquare,
  search: FileSearch,
  error: AlertCircle,
};

const defaultColors: Record<EmptyStateType, string> = {
  users: 'text-primary',
  jobs: 'text-primary',
  handovers: 'text-success',
  conversations: 'text-info',
  search: 'text-muted-foreground',
  error: 'text-destructive',
};

export function EmptyState({
  type = 'search',
  icon,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  const Icon = icon || defaultIcons[type];
  const iconColor = defaultColors[type];

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center px-4', className)}>
      <div className={cn(
        'h-16 w-16 rounded-full flex items-center justify-center mb-4',
        type === 'error' ? 'bg-destructive/10' : 'bg-muted'
      )}>
        <Icon className={cn('h-8 w-8', iconColor)} />
      </div>
      <h3 className="font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
