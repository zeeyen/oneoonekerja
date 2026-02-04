import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats, useDashboardRefresh } from '@/hooks/useDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Briefcase,
  Clock,
  CheckCircle,
  RefreshCw,
  Plus,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
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
    },
    {
      title: 'Active Today',
      value: stats?.activeToday ?? 0,
      icon: Clock,
      description: 'Applicants active today',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Completed Onboarding',
      value: stats?.completedOnboarding ?? 0,
      icon: CheckCircle,
      description: 'Fully onboarded applicants',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
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
          <Button variant="outline" onClick={() => navigate('/jobs/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Job
          </Button>
          <Button variant="outline" onClick={() => navigate('/applicants')}>
            <Users className="mr-2 h-4 w-4" />
            View Applicants
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
