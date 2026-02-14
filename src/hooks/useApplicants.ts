import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Applicant } from '@/types/database';

export type ApplicantFilter = 'all' | 'active' | 'completed' | 'in_progress' | 'matching' | 'new' | 'banned' | 'has_violations';

interface UseApplicantsOptions {
  search: string;
  filter: ApplicantFilter;
  page: number;
  pageSize: number;
  since?: string | null;
}

interface ApplicantsResult {
  applicants: Applicant[];
  totalCount: number;
  totalPages: number;
}

async function fetchApplicants({
  search,
  filter,
  page,
  pageSize,
  since,
}: UseApplicantsOptions): Promise<ApplicantsResult> {
  let query = supabase
    .from('applicants')
    .select('*', { count: 'exact' });

  if (since) {
    query = query.gte('last_active_at', since);
  }

  // Apply search filter
  if (search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    query = query.or(
      `full_name.ilike.${searchTerm},phone_number.ilike.${searchTerm},ic_number.ilike.${searchTerm}`
    );
  }

  // Apply status filter
  switch (filter) {
    case 'active':
      query = query.eq('is_active', true);
      break;
    case 'completed':
      query = query.eq('onboarding_status', 'completed');
      break;
    case 'in_progress':
      query = query.eq('onboarding_status', 'in_progress');
      break;
    case 'new':
      query = query.eq('onboarding_status', 'new');
      break;
    case 'matching':
      query = query.eq('onboarding_status', 'matching');
      break;
    case 'banned':
      query = query
        .not('banned_until', 'is', null)
        .gt('banned_until', new Date().toISOString());
      break;
    case 'has_violations':
      query = query.gt('violation_count', 0);
      break;
  }

  // Order and paginate
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query
    .order('last_active_at', { ascending: false })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching applicants:', error);
    throw error;
  }

  return {
    applicants: data ?? [],
    totalCount: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function fetchAllFilteredApplicants(
  search: string,
  filter: ApplicantFilter,
  since?: string | null
): Promise<Applicant[]> {
  const allResults: Applicant[] = [];
  const chunkSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from('applicants').select('*');

    if (since) {
      query = query.gte('last_active_at', since);
    }

    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(
        `full_name.ilike.${searchTerm},phone_number.ilike.${searchTerm},ic_number.ilike.${searchTerm}`
      );
    }

    switch (filter) {
      case 'active':
        query = query.eq('is_active', true);
        break;
      case 'completed':
        query = query.eq('onboarding_status', 'completed');
        break;
      case 'in_progress':
        query = query.eq('onboarding_status', 'in_progress');
        break;
      case 'new':
        query = query.eq('onboarding_status', 'new');
        break;
      case 'matching':
        query = query.eq('onboarding_status', 'matching');
        break;
      case 'banned':
        query = query
          .not('banned_until', 'is', null)
          .gt('banned_until', new Date().toISOString());
        break;
      case 'has_violations':
        query = query.gt('violation_count', 0);
        break;
    }

    query = query
      .order('last_active_at', { ascending: false })
      .range(from, from + chunkSize - 1);

    const { data, error } = await query;
    if (error) throw error;

    allResults.push(...(data ?? []));
    hasMore = (data?.length ?? 0) === chunkSize;
    from += chunkSize;
  }

  return allResults;
}

export function useApplicants(options: UseApplicantsOptions) {
  return useQuery({
    queryKey: ['applicants', options],
    queryFn: () => fetchApplicants(options),
    staleTime: 30000,
  });
}

export async function fetchTotalApplicantsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('applicants')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error fetching applicants count:', error);
    return 0;
  }

  return count ?? 0;
}

export function useTotalApplicantsCount() {
  return useQuery({
    queryKey: ['applicants-total-count'],
    queryFn: fetchTotalApplicantsCount,
    staleTime: 60000,
  });
}
