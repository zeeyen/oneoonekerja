import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Job, JobMatch, Applicant } from '@/types/database';

export interface JobMatchWithApplicant extends JobMatch {
  applicant?: Pick<Applicant, 'id' | 'full_name' | 'phone_number'>;
}

async function fetchJobById(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching job:', error);
    throw error;
  }

  return data;
}

async function fetchJobMatches(jobId: string): Promise<JobMatchWithApplicant[]> {
  const { data, error } = await supabase
    .from('job_matches')
    .select(`
      *,
      applicant:applicants(id, full_name, phone_number)
    `)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching job matches:', error);
    return [];
  }

  return (data ?? []).map((item) => ({
    ...item,
    applicant: Array.isArray(item.applicant) ? item.applicant[0] : item.applicant,
  }));
}

export function useJobDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['job-detail', id],
    queryFn: () => fetchJobById(id!),
    enabled: !!id,
  });
}

export function useJobMatches(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job-matches', jobId],
    queryFn: () => fetchJobMatches(jobId!),
    enabled: !!jobId,
  });
}
