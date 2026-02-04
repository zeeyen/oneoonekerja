import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { HandoverWithDetails } from '@/types/database';

interface DashboardStats {
  totalApplicants: number;
  activeToday: number;
  pendingVerification: number;
  activeJobs: number;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [applicantsResult, activeTodayResult, pendingResult, jobsResult] = await Promise.all([
    supabase.from('applicants').select('*', { count: 'exact', head: true }),
    supabase.from('applicants').select('*', { count: 'exact', head: true }).gte('last_active_at', todayISO),
    supabase.from('handovers').select('*', { count: 'exact', head: true }).eq('status', 'pending_verification'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  return {
    totalApplicants: applicantsResult.count ?? 0,
    activeToday: activeTodayResult.count ?? 0,
    pendingVerification: pendingResult.count ?? 0,
    activeJobs: jobsResult.count ?? 0,
  };
}

async function fetchRecentHandovers(): Promise<HandoverWithDetails[]> {
  const { data, error } = await supabase
    .from('handovers')
    .select(`
      *,
      user:applicants(full_name, phone_number),
      job:jobs(job_title, position)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching recent handovers:', error);
    return [];
  }

  return (data ?? []).map((item) => ({
    ...item,
    user: Array.isArray(item.user) ? item.user[0] : item.user,
    job: Array.isArray(item.job) ? item.job[0] : item.job,
  }));
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 30000, // 30 seconds
  });
}

export function useRecentHandovers() {
  return useQuery({
    queryKey: ['recent-handovers'],
    queryFn: fetchRecentHandovers,
    staleTime: 30000,
  });
}

export function useDashboardRefresh() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['recent-handovers'] });
  };
}
