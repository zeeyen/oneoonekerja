import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { HandoverWithDetails, HandoverStatus } from '@/types/database';

export type HandoverTab = 'pending' | 'verified' | 'in_progress' | 'completed' | 'all';

const TAB_STATUSES: Record<HandoverTab, HandoverStatus[] | null> = {
  pending: ['pending_verification'],
  verified: ['verified'],
  in_progress: ['approved', 'interview_scheduled', 'interviewed', 'offer_made'],
  completed: ['hired', 'started_work'],
  all: null,
};

async function fetchHandovers(tab: HandoverTab): Promise<HandoverWithDetails[]> {
  let query = supabase
    .from('handovers')
    .select(`
      *,
      user:users(full_name, phone_number),
      job:jobs(job_title, position)
    `)
    .order('created_at', { ascending: false });

  const statuses = TAB_STATUSES[tab];
  if (statuses) {
    query = query.in('status', statuses);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching handovers:', error);
    throw error;
  }

  return data || [];
}

async function fetchHandoverCounts(): Promise<Record<HandoverTab, number>> {
  const { data, error } = await supabase
    .from('handovers')
    .select('status');

  if (error) {
    console.error('Error fetching handover counts:', error);
    throw error;
  }

  const counts: Record<HandoverTab, number> = {
    pending: 0,
    verified: 0,
    in_progress: 0,
    completed: 0,
    all: data?.length || 0,
  };

  data?.forEach((item) => {
    const status = item.status as HandoverStatus;
    if (TAB_STATUSES.pending?.includes(status)) counts.pending++;
    if (TAB_STATUSES.verified?.includes(status)) counts.verified++;
    if (TAB_STATUSES.in_progress?.includes(status)) counts.in_progress++;
    if (TAB_STATUSES.completed?.includes(status)) counts.completed++;
  });

  return counts;
}

export function useHandovers(tab: HandoverTab) {
  return useQuery({
    queryKey: ['handovers', tab],
    queryFn: () => fetchHandovers(tab),
  });
}

export function useHandoverCounts() {
  return useQuery({
    queryKey: ['handover-counts'],
    queryFn: fetchHandoverCounts,
  });
}

export async function searchHandoverByToken(token: string): Promise<HandoverWithDetails | null> {
  const { data, error } = await supabase
    .from('handovers')
    .select(`
      *,
      user:users(full_name, phone_number),
      job:jobs(job_title, position)
    `)
    .eq('eligibility_token', token.trim().toUpperCase())
    .maybeSingle();

  if (error) {
    console.error('Error searching handover:', error);
    throw error;
  }

  return data;
}
