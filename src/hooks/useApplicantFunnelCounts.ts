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

async function fetchFunnelCounts(since: string | null): Promise<FunnelCounts> {
  const statuses = ['new', 'in_progress', 'matching', 'completed'] as const;

  const countPromises = statuses.map((status) => {
    let q = supabase
      .from('applicants')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_status', status);
    if (since) q = q.gte('last_active_at', since);
    return q;
  });

  // Banned count
  let bannedQuery = supabase
    .from('applicants')
    .select('*', { count: 'exact', head: true })
    .not('banned_until', 'is', null)
    .gt('banned_until', new Date().toISOString());
  if (since) bannedQuery = bannedQuery.gte('last_active_at', since);

  let totalQuery = supabase
    .from('applicants')
    .select('*', { count: 'exact', head: true });
  if (since) totalQuery = totalQuery.gte('last_active_at', since);

  const [newRes, inProgressRes, matchingRes, completedRes, bannedRes, totalRes] =
    await Promise.all([...countPromises, bannedQuery, totalQuery]);

  return {
    new: newRes.count ?? 0,
    in_progress: inProgressRes.count ?? 0,
    matching: matchingRes.count ?? 0,
    completed: completedRes.count ?? 0,
    banned: bannedRes.count ?? 0,
    total: totalRes.count ?? 0,
  };
}

export function useApplicantFunnelCounts(since: string | null = null) {
  return useQuery({
    queryKey: ['applicant-funnel-counts', since],
    queryFn: () => fetchFunnelCounts(since),
    staleTime: 30000,
  });
}
