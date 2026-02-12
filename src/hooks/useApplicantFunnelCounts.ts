import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface FunnelCounts {
  new: number;
  in_progress: number;
  matching: number;
  completed: number;
  banned: number;
  total: number;
}

async function fetchFunnelCounts(): Promise<FunnelCounts> {
  const statuses = ['new', 'in_progress', 'matching', 'completed'] as const;

  const countPromises = statuses.map((status) =>
    supabase
      .from('applicants')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_status', status)
  );

  // Banned count
  const bannedPromise = supabase
    .from('applicants')
    .select('*', { count: 'exact', head: true })
    .not('banned_until', 'is', null)
    .gt('banned_until', new Date().toISOString());

  const totalPromise = supabase
    .from('applicants')
    .select('*', { count: 'exact', head: true });

  const [newRes, inProgressRes, matchingRes, completedRes, bannedRes, totalRes] =
    await Promise.all([...countPromises, bannedPromise, totalPromise]);

  return {
    new: newRes.count ?? 0,
    in_progress: inProgressRes.count ?? 0,
    matching: matchingRes.count ?? 0,
    completed: completedRes.count ?? 0,
    banned: bannedRes.count ?? 0,
    total: totalRes.count ?? 0,
  };
}

export function useApplicantFunnelCounts() {
  return useQuery({
    queryKey: ['applicant-funnel-counts'],
    queryFn: fetchFunnelCounts,
    staleTime: 30000,
  });
}
