import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Applicant, JobMatch, Conversation, Job } from '@/types/database';

export interface JobMatchWithJob extends JobMatch {
  job?: Pick<Job, 'title' | 'company'>;
}

async function fetchApplicantById(id: string): Promise<Applicant | null> {
  const { data, error } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching applicant:', error);
    throw error;
  }

  return data;
}

async function fetchApplicantJobMatches(applicantId: string): Promise<JobMatchWithJob[]> {
  const { data, error } = await supabase
    .from('job_matches')
    .select(`
      *,
      job:jobs(title, company)
    `)
    .eq('user_id', applicantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching job matches:', error);
    return [];
  }

  return (data ?? []).map((item) => ({
    ...item,
    job: Array.isArray(item.job) ? item.job[0] : item.job,
  }));
}

async function fetchApplicantConversations(applicantId: string, phoneNumber?: string): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: true });

  // Try by user_id first, fallback to phone_number
  if (applicantId) {
    query = query.eq('user_id', applicantId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }

  // If no data by user_id and we have phone number, try by phone
  if ((!data || data.length === 0) && phoneNumber) {
    const { data: phoneData, error: phoneError } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('created_at', { ascending: true });

    if (phoneError) {
      console.error('Error fetching conversations by phone:', phoneError);
      return [];
    }

    return phoneData ?? [];
  }

  return data ?? [];
}

export function useApplicantDetail(id: string) {
  return useQuery({
    queryKey: ['applicant', id],
    queryFn: () => fetchApplicantById(id),
    enabled: !!id,
  });
}

export function useApplicantJobMatches(applicantId: string) {
  return useQuery({
    queryKey: ['applicant-job-matches', applicantId],
    queryFn: () => fetchApplicantJobMatches(applicantId),
    enabled: !!applicantId,
  });
}

export function useApplicantConversations(applicantId: string, phoneNumber?: string) {
  return useQuery({
    queryKey: ['applicant-conversations', applicantId, phoneNumber],
    queryFn: () => fetchApplicantConversations(applicantId, phoneNumber),
    enabled: !!applicantId || !!phoneNumber,
  });
}
