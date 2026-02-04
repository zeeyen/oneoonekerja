import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Applicant } from '@/types/database';

interface DashboardStats {
  totalApplicants: number;
  activeToday: number;
  activeJobs: number;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  const todayDate = today.toISOString().split('T')[0];

  const [applicantsResult, activeTodayResult, jobsResult] = await Promise.all([
    supabase.from('applicants').select('*', { count: 'exact', head: true }),
    supabase.from('applicants').select('*', { count: 'exact', head: true }).gte('last_active_at', todayISO),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).gte('expire_by', todayDate),
  ]);

  return {
    totalApplicants: applicantsResult.count ?? 0,
    activeToday: activeTodayResult.count ?? 0,
    activeJobs: jobsResult.count ?? 0,
  };
}

async function fetchRecentApplicants(): Promise<Applicant[]> {
  const { data, error } = await supabase
    .from('applicants')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching recent applicants:', error);
    return [];
  }

  return data ?? [];
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 30000, // 30 seconds
  });
}

export function useRecentApplicants() {
  return useQuery({
    queryKey: ['dashboard-recent-applicants'],
    queryFn: fetchRecentApplicants,
    staleTime: 30000, // 30 seconds
  });
}

export function useDashboardRefresh() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-recent-applicants'] });
  };
}
