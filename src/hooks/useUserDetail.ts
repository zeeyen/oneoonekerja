import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { User, JobMatch, Handover, Conversation, Job } from '@/types/database';

export interface JobMatchWithJob extends JobMatch {
  job?: Pick<Job, 'job_title' | 'position'>;
}

export interface HandoverWithJob extends Handover {
  job?: Pick<Job, 'job_title' | 'position'>;
}

async function fetchUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user:', error);
    throw error;
  }

  return data;
}

async function fetchUserJobMatches(userId: string): Promise<JobMatchWithJob[]> {
  const { data, error } = await supabase
    .from('job_matches')
    .select(`
      *,
      job:jobs(job_title, position)
    `)
    .eq('user_id', userId)
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

async function fetchUserHandovers(userId: string): Promise<HandoverWithJob[]> {
  const { data, error } = await supabase
    .from('handovers')
    .select(`
      *,
      job:jobs(job_title, position)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching handovers:', error);
    return [];
  }

  return (data ?? []).map((item) => ({
    ...item,
    job: Array.isArray(item.job) ? item.job[0] : item.job,
  }));
}

async function fetchUserConversations(userId: string, phoneNumber?: string): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: true });

  // Try by user_id first, fallback to phone_number
  if (userId) {
    query = query.eq('user_id', userId);
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

export function useUserDetail(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUserById(id),
    enabled: !!id,
  });
}

export function useUserJobMatches(userId: string) {
  return useQuery({
    queryKey: ['user-job-matches', userId],
    queryFn: () => fetchUserJobMatches(userId),
    enabled: !!userId,
  });
}

export function useUserHandovers(userId: string) {
  return useQuery({
    queryKey: ['user-handovers', userId],
    queryFn: () => fetchUserHandovers(userId),
    enabled: !!userId,
  });
}

export function useUserConversations(userId: string, phoneNumber?: string) {
  return useQuery({
    queryKey: ['user-conversations', userId, phoneNumber],
    queryFn: () => fetchUserConversations(userId, phoneNumber),
    enabled: !!userId || !!phoneNumber,
  });
}
