import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Briefcase, BadgeCheck, TrendingUp } from 'lucide-react';

const stats = [
  {
    title: 'Total Job Seekers',
    value: '2,847',
    change: '+12.5%',
    icon: Users,
    description: 'Registered via WhatsApp',
  },
  {
    title: 'Active Jobs',
    value: '156',
    change: '+8.2%',
    icon: Briefcase,
    description: 'Open positions',
  },
  {
    title: 'Verified Candidates',
    value: '1,432',
    change: '+15.3%',
    icon: BadgeCheck,
    description: 'Eligibility confirmed',
  },
  {
    title: 'Placements This Month',
    value: '89',
    change: '+23.1%',
    icon: TrendingUp,
    description: 'Successful hires',
  },
];

export default function Dashboard() {
  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">
          Overview of 101Kerja job matching platform activity
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-interactive">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium text-success">{stat.change}</span>
                <span className="text-xs text-muted-foreground">{stat.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity and quick actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Job Seekers</CardTitle>
            <CardDescription>
              Latest registrations from WhatsApp chatbot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-24 bg-muted rounded mt-1.5 animate-pulse" />
                  </div>
                  <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center mt-6">
              Connect to Supabase to view real data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Verifications</CardTitle>
            <CardDescription>
              Candidates awaiting eligibility token verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <BadgeCheck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-24 bg-muted rounded mt-1.5 animate-pulse" />
                  </div>
                  <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center mt-6">
              Connect to Supabase to view real data
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
