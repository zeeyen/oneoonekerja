import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TimeFilter = '24h' | '7d' | '1m' | 'all';

export function getSinceDate(timeFilter: TimeFilter): string | null {
  switch (timeFilter) {
    case '24h':
      return new Date(Date.now() - 86400000).toISOString();
    case '7d':
      return new Date(Date.now() - 7 * 86400000).toISOString();
    case '1m':
      return new Date(Date.now() - 30 * 86400000).toISOString();
    case 'all':
      return null;
  }
}

interface JobCount {
  job_id: string;
  count: number;
}

export function useJobMatchCounts(timeFilter: TimeFilter) {
  const since = getSinceDate(timeFilter);
  return useQuery({
    queryKey: ['job-match-counts', timeFilter],
    queryFn: async (): Promise<JobCount[]> => {
      const { data, error } = await supabase.rpc('get_job_match_counts', {
        since_ts: since,
      });
      if (error) throw error;
      return (data || []).map((r: { job_id: string; match_count: number }) => ({
        job_id: r.job_id,
        count: Number(r.match_count),
      }));
    },
  });
}

export function useJobSelectionCounts(timeFilter: TimeFilter) {
  const since = getSinceDate(timeFilter);
  return useQuery({
    queryKey: ['job-selection-counts', timeFilter],
    queryFn: async (): Promise<JobCount[]> => {
      let query = supabase
        .from('job_selections')
        .select('job_id');

      if (since) {
        query = query.gte('selected_at', since);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by job_id client-side
      const counts = new Map<string, number>();
      for (const row of data || []) {
        if (row.job_id) {
          counts.set(row.job_id, (counts.get(row.job_id) || 0) + 1);
        }
      }

      return Array.from(counts.entries())
        .map(([job_id, count]) => ({ job_id, count }))
        .sort((a, b) => b.count - a.count);
    },
  });
}
