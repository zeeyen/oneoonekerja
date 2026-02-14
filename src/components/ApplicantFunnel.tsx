import type { ApplicantFilter } from '@/hooks/useApplicants';
import type { FunnelCounts } from '@/hooks/useApplicantFunnelCounts';
import { useApplicantFunnelCounts } from '@/hooks/useApplicantFunnelCounts';
import type { TimeFilter } from '@/hooks/useJobStats';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, UserPlus, Search, CheckCircle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApplicantFunnelProps {
  activeFilter: ApplicantFilter;
  onFilterChange: (filter: ApplicantFilter) => void;
  timeFilter?: TimeFilter;
}

const funnelSteps: {
  key: keyof FunnelCounts;
  filterValue: ApplicantFilter;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  activeClass: string;
}[] = [
  {
    key: 'new',
    filterValue: 'new',
    label: 'New',
    icon: UserPlus,
    colorClass: 'border-blue-200 bg-blue-50 text-blue-700',
    activeClass: 'ring-2 ring-blue-400 border-blue-400 bg-blue-100',
  },
  {
    key: 'in_progress',
    filterValue: 'in_progress',
    label: 'In Progress',
    icon: Users,
    colorClass: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    activeClass: 'ring-2 ring-yellow-400 border-yellow-400 bg-yellow-100',
  },
  {
    key: 'matching',
    filterValue: 'matching',
    label: 'Matching',
    icon: Search,
    colorClass: 'border-purple-200 bg-purple-50 text-purple-700',
    activeClass: 'ring-2 ring-purple-400 border-purple-400 bg-purple-100',
  },
  {
    key: 'completed',
    filterValue: 'completed',
    label: 'Completed',
    icon: CheckCircle,
    colorClass: 'border-green-200 bg-green-50 text-green-700',
    activeClass: 'ring-2 ring-green-400 border-green-400 bg-green-100',
  },
  {
    key: 'banned',
    filterValue: 'banned',
    label: 'Banned',
    icon: Ban,
    colorClass: 'border-red-200 bg-red-50 text-red-700',
    activeClass: 'ring-2 ring-red-400 border-red-400 bg-red-100',
  },
];

export function ApplicantFunnel({ activeFilter, onFilterChange, timeFilter = 'all' }: ApplicantFunnelProps) {
  const { data, isLoading } = useApplicantFunnelCounts(timeFilter);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* All card */}
      <button
        onClick={() => onFilterChange('all')}
        className={cn(
          'flex flex-col items-center justify-center gap-1 rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm',
          'border-muted bg-muted/30 text-muted-foreground',
          activeFilter === 'all' && 'ring-2 ring-primary border-primary bg-primary/5 text-foreground'
        )}
      >
        <Users className="h-5 w-5" />
        <span className="text-lg font-bold">{data.total}</span>
        <span className="text-xs font-medium">All</span>
      </button>

      {funnelSteps.map((step) => {
        const Icon = step.icon;
        const isActive = activeFilter === step.filterValue;
        return (
          <button
            key={step.key}
            onClick={() => onFilterChange(step.filterValue)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm',
              step.colorClass,
              isActive && step.activeClass
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-lg font-bold">{data[step.key]}</span>
            <span className="text-xs font-medium">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
