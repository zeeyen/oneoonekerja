import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats, useRecentApplicants, useDashboardRefresh } from '@/hooks/useDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TooltipHeader } from '@/components/TooltipHeader';
import {
  Users,
  Briefcase,
  Activity,
  RefreshCw,
  Info,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function formatPhoneNumber(phone: string | null): string {
  if (!phone) return '-';
  // Format: +60 12-345 6789
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('60') && cleaned.length >= 10) {
    const rest = cleaned.slice(2);
    if (rest.length === 9) {
      return `+60 ${rest.slice(0, 2)}-${rest.slice(2, 5)} ${rest.slice(5)}`;
    } else if (rest.length === 10) {
      return `+60 ${rest.slice(0, 2)}-${rest.slice(2, 6)} ${rest.slice(6)}`;
    }
  }
  return phone;
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
    case 'in_progress':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">In Progress</Badge>;
    case 'new':
    default:
      return <Badge variant="secondary">New</Badge>;
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentApplicants, isLoading: applicantsLoading } = useRecentApplicants();
  const refreshDashboard = useDashboardRefresh();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshDashboard();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const statCards = [
    {
      title: 'Total Applicants',
      value: stats?.totalApplicants ?? 0,
      icon: Users,
      description: 'Registered job seekers',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      tooltip: 'All users who have messaged the WhatsApp bot',
    },
    {
      title: 'Active Today',
      value: stats?.activeToday ?? 0,
      icon: Activity,
      description: 'Applicants active today',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      tooltip: 'Users who sent at least one message in the last 24 hours',
    },
    {
      title: 'Active Jobs',
      value: stats?.activeJobs ?? 0,
      icon: Briefcase,
      description: 'Open positions',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      tooltip: 'Job listings with valid expiration dates',
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user?.email?.split('@')[0] || 'Admin'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with 101Kerja today.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats cards - 3 cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[250px]">
                    <p className="text-xs">{stat.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className={`h-9 w-9 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Applicants */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recent Applicants</CardTitle>
          <CardDescription>Last 10 applicants who registered</CardDescription>
        </CardHeader>
        <CardContent>
          {applicantsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentApplicants && recentApplicants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>
                    <TooltipHeader 
                      label="Location" 
                      tooltip="Extracted from user's chat message" 
                    />
                  </TableHead>
                  <TableHead>
                    <TooltipHeader 
                      label="Status" 
                      tooltip="Bot flow status: new → in_progress → matching → completed" 
                    />
                  </TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentApplicants.map((applicant) => (
                  <TableRow
                    key={applicant.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/applicants/${applicant.id}`)}
                  >
                    <TableCell className="font-medium">
                      {applicant.full_name || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatPhoneNumber(applicant.phone_number)}
                    </TableCell>
                    <TableCell>
                      {applicant.location_city && applicant.location_state
                        ? `${applicant.location_city}, ${applicant.location_state}`
                        : applicant.location_city || applicant.location_state || '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(applicant.onboarding_status)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {applicant.created_at
                        ? formatDistanceToNow(new Date(applicant.created_at), { addSuffix: true })
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No applicants registered yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
