import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/types/database';

export type JobStatusFilter = 'all' | 'active' | 'expired';

interface UseJobsOptions {
  search: string;
  statusFilter: JobStatusFilter;
  industryFilter: string;
  stateFilter: string;
  page: number;
  pageSize: number;
}

interface JobsResult {
  jobs: Job[];
  totalCount: number;
  totalPages: number;
}

export const MALAYSIAN_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Labuan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Penang',
  'Perak',
  'Perlis',
  'Putrajaya',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
];

export const INDUSTRY_OPTIONS = [
  'Manufacturing',
  'Retail',
  'Logistics',
  'Food & Beverage',
  'Office',
  'Transportation',
  'Recruitment',
  'Education',
  'Other',
];

async function fetchJobs({
  search,
  statusFilter,
  industryFilter,
  stateFilter,
  page,
  pageSize,
}: UseJobsOptions): Promise<JobsResult> {
  const today = new Date().toISOString().split('T')[0];
  let query = supabase.from('jobs').select('*', { count: 'exact' });

  // Apply search filter
  if (search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    query = query.or(`title.ilike.${searchTerm},company.ilike.${searchTerm},external_job_id.ilike.${searchTerm}`);
  }

  // Apply status filter (based on expire_by date)
  if (statusFilter === 'active') {
    query = query.gte('expire_by', today);
  } else if (statusFilter === 'expired') {
    query = query.lt('expire_by', today);
  }

  // Apply industry filter
  if (industryFilter && industryFilter !== 'all') {
    query = query.eq('industry', industryFilter);
  }

  // Apply state filter
  if (stateFilter && stateFilter !== 'all') {
    query = query.eq('location_state', stateFilter);
  }

  // Order and paginate
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order('expire_by', { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching jobs:', error);
    throw error;
  }

  return {
    jobs: data ?? [],
    totalCount: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

async function fetchActiveJobsCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .gte('expire_by', today);

  if (error) {
    console.error('Error fetching active jobs count:', error);
    return 0;
  }

  return count ?? 0;
}

async function deleteJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', jobId);

  if (error) {
    console.error('Error deleting job:', error);
    throw error;
  }
}

export function useJobs(options: UseJobsOptions) {
  return useQuery({
    queryKey: ['jobs', options],
    queryFn: () => fetchJobs(options),
    staleTime: 30000,
  });
}

export function useActiveJobsCount() {
  return useQuery({
    queryKey: ['jobs-active-count'],
    queryFn: fetchActiveJobsCount,
    staleTime: 60000,
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-active-count'] });
    },
  });
}
