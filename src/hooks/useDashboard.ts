import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  totalApplicants: number;
  activeToday: number;
  completedOnboarding: number;
  activeJobs: number;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  const todayDate = today.toISOString().split('T')[0];

  const [applicantsResult, activeTodayResult, completedResult, jobsResult] = await Promise.all([
    supabase.from('applicants').select('*', { count: 'exact', head: true }),
    supabase.from('applicants').select('*', { count: 'exact', head: true }).gte('last_active_at', todayISO),
    supabase.from('applicants').select('*', { count: 'exact', head: true }).eq('onboarding_status', 'completed'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).gte('expire_by', todayDate),
  ]);

  return {
    totalApplicants: applicantsResult.count ?? 0,
    activeToday: activeTodayResult.count ?? 0,
    completedOnboarding: completedResult.count ?? 0,
    activeJobs: jobsResult.count ?? 0,
  };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 30000, // 30 seconds
  });
}

export function useDashboardRefresh() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };
}
