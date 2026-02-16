import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { type TimeFilter, getSinceDate } from '@/hooks/useJobStats';

export interface FunnelCounts {
  new: number;
  in_progress: number;
  matching: number;
  completed: number;
  follow_up: number;
  banned: number;
  total: number;
}

async function fetchFunnelCounts(timeFilter: TimeFilter): Promise<FunnelCounts> {
  const since = getSinceDate(timeFilter);
  const statuses = ['new', 'in_progress', 'matching', 'completed', 'follow_up'] as const;

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

  const [newRes, inProgressRes, matchingRes, completedRes, followUpRes, bannedRes, totalRes] =
    await Promise.all([...countPromises, bannedQuery, totalQuery]);

  return {
    new: newRes.count ?? 0,
    in_progress: inProgressRes.count ?? 0,
    matching: matchingRes.count ?? 0,
    completed: completedRes.count ?? 0,
    follow_up: followUpRes.count ?? 0,
    banned: bannedRes.count ?? 0,
    total: totalRes.count ?? 0,
  };
}

export function useApplicantFunnelCounts(timeFilter: TimeFilter = 'all') {
  return useQuery({
    queryKey: ['applicant-funnel-counts', timeFilter],
    queryFn: () => fetchFunnelCounts(timeFilter),
    staleTime: 30000,
  });
}
