import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/types/database';

export type JobStatusFilter = 'all' | 'active' | 'inactive';
export type JobTypeFilter = 'all' | 'part_time' | 'full_time';

interface UseJobsOptions {
  search: string;
  statusFilter: JobStatusFilter;
  typeFilter: JobTypeFilter;
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

async function fetchJobs({
  search,
  statusFilter,
  typeFilter,
  stateFilter,
  page,
  pageSize,
}: UseJobsOptions): Promise<JobsResult> {
  let query = supabase.from('jobs').select('*', { count: 'exact' });

  // Apply search filter
  if (search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    query = query.or(`job_title.ilike.${searchTerm},position.ilike.${searchTerm}`);
  }

  // Apply status filter
  if (statusFilter === 'active') {
    query = query.eq('is_active', true);
  } else if (statusFilter === 'inactive') {
    query = query.eq('is_active', false);
  }

  // Apply job type filter
  if (typeFilter === 'part_time') {
    query = query.eq('job_type', 1);
  } else if (typeFilter === 'full_time') {
    query = query.eq('job_type', 2);
  }

  // Apply state filter
  if (stateFilter && stateFilter !== 'all') {
    query = query.eq('location_state', stateFilter);
  }

  // Order and paginate
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order('created_at', { ascending: false }).range(from, to);

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
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching active jobs count:', error);
    return 0;
  }

  return count ?? 0;
}

async function updateJobStatus(jobId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ is_active: isActive })
    .eq('id', jobId);

  if (error) {
    console.error('Error updating job status:', error);
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

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, isActive }: { jobId: string; isActive: boolean }) =>
      updateJobStatus(jobId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-active-count'] });
    },
  });
}
