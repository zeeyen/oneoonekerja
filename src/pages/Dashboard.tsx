import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats, useRecentHandovers, useDashboardRefresh } from '@/hooks/useDashboard';
import { TokenVerificationModal } from '@/components/TokenVerificationModal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorFallback } from '@/components/ErrorFallback';
import { getStatusConfig } from '@/lib/statusConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Briefcase,
  Clock,
  CheckCircle,
  RefreshCw,
  Search,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: recentHandovers, isLoading: handoversLoading, isError: handoversError, refetch: refetchHandovers } = useRecentHandovers();
  const refreshDashboard = useDashboardRefresh();
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshDashboard();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      description: 'Registered job seekers',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Today',
      value: stats?.activeToday ?? 0,
      icon: Clock,
      description: 'Users active today',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Pending Verification',
      value: stats?.pendingVerification ?? 0,
      icon: CheckCircle,
      description: 'Awaiting verification',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Active Jobs',
      value: stats?.activeJobs ?? 0,
      icon: Briefcase,
      description: 'Open positions',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
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

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
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

      {/* Quick Actions */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>Common tasks you can perform quickly</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => setTokenModalOpen(true)}>
            <Search className="mr-2 h-4 w-4" />
            Verify Token
          </Button>
          <Button variant="outline" onClick={() => navigate('/jobs/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Job
          </Button>
        </CardContent>
      </Card>

      {/* Recent Handovers Table */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Handovers</CardTitle>
            <CardDescription>Latest candidates sent to recruiters</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/handovers')}>
            View all
          </Button>
        </CardHeader>
        <CardContent>
          {handoversLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : handoversError ? (
            <ErrorFallback
              title="Failed to load handovers"
              message="We couldn't load recent handovers."
              onRetry={() => refetchHandovers()}
            />
          ) : recentHandovers && recentHandovers.length > 0 ? (
            <div className="table-responsive">
              <div className="rounded-md border min-w-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentHandovers.map((handover) => {
                      const statusConfig = getStatusConfig(handover.status);
                      return (
                        <TableRow
                          key={handover.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/handovers/${handover.id}`)}
                        >
                          <TableCell className="font-medium">
                            {handover.user?.full_name || 'Unknown'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {handover.user?.phone_number || '-'}
                          </TableCell>
                          <TableCell>
                            {handover.job?.job_title || 'Unknown Job'}
                          </TableCell>
                          <TableCell>
                            <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                              {handover.eligibility_token}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig.className}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(handover.created_at), 'dd MMM yyyy')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <EmptyState
              type="handovers"
              title="No handovers yet"
              description="Handovers will appear here once candidates are sent to recruiters."
            />
          )}
        </CardContent>
      </Card>

      {/* Token Verification Modal */}
      <TokenVerificationModal
        open={tokenModalOpen}
        onOpenChange={setTokenModalOpen}
      />
    </div>
  );
}
