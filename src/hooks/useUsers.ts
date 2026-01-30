import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types/database';

export type UserFilter = 'all' | 'active' | 'completed' | 'in_progress' | 'new';

interface UseUsersOptions {
  search: string;
  filter: UserFilter;
  page: number;
  pageSize: number;
}

interface UsersResult {
  users: User[];
  totalCount: number;
  totalPages: number;
}

async function fetchUsers({
  search,
  filter,
  page,
  pageSize,
}: UseUsersOptions): Promise<UsersResult> {
  let query = supabase
    .from('users')
    .select('*', { count: 'exact' });

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
  }

  // Order and paginate
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query
    .order('last_active_at', { ascending: false })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching users:', error);
    throw error;
  }

  return {
    users: data ?? [],
    totalCount: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export function useUsers(options: UseUsersOptions) {
  return useQuery({
    queryKey: ['users', options],
    queryFn: () => fetchUsers(options),
    staleTime: 30000,
  });
}

export async function fetchTotalUsersCount(): Promise<number> {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error fetching users count:', error);
    return 0;
  }

  return count ?? 0;
}

export function useTotalUsersCount() {
  return useQuery({
    queryKey: ['users-total-count'],
    queryFn: fetchTotalUsersCount,
    staleTime: 60000,
  });
}
