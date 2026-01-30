import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Conversation } from '@/types/database';
import { startOfDay, endOfDay, format } from 'date-fns';

export interface ConversationFilters {
  phoneSearch: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  direction: 'all' | 'inbound' | 'outbound';
  page: number;
  pageSize: number;
}

interface ConversationsResult {
  data: Conversation[];
  totalCount: number;
}

interface ConversationStats {
  totalMessagesToday: number;
  totalTokensToday: number;
  avgProcessingTime: number;
}

async function fetchConversations(filters: ConversationFilters): Promise<ConversationsResult> {
  let query = supabase
    .from('conversations')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  // Phone search
  if (filters.phoneSearch.trim()) {
    query = query.ilike('phone_number', `%${filters.phoneSearch.trim()}%`);
  }

  // Date range
  if (filters.dateFrom) {
    query = query.gte('created_at', startOfDay(filters.dateFrom).toISOString());
  }
  if (filters.dateTo) {
    query = query.lte('created_at', endOfDay(filters.dateTo).toISOString());
  }

  // Direction filter
  if (filters.direction !== 'all') {
    query = query.eq('direction', filters.direction);
  }

  // Pagination
  const from = filters.page * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }

  return {
    data: data || [],
    totalCount: count || 0,
  };
}

async function fetchConversationStats(): Promise<ConversationStats> {
  const today = new Date();
  const startOfToday = startOfDay(today).toISOString();
  const endOfToday = endOfDay(today).toISOString();

  const { data, error } = await supabase
    .from('conversations')
    .select('llm_tokens_used, processing_time_ms')
    .gte('created_at', startOfToday)
    .lte('created_at', endOfToday);

  if (error) {
    console.error('Error fetching conversation stats:', error);
    throw error;
  }

  const totalMessagesToday = data?.length || 0;
  const totalTokensToday = data?.reduce((sum, c) => sum + (c.llm_tokens_used || 0), 0) || 0;
  const processingTimes = data?.filter((c) => c.processing_time_ms != null).map((c) => c.processing_time_ms!) || [];
  const avgProcessingTime =
    processingTimes.length > 0
      ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
      : 0;

  return {
    totalMessagesToday,
    totalTokensToday,
    avgProcessingTime,
  };
}

async function fetchAllConversationsForExport(filters: Omit<ConversationFilters, 'page' | 'pageSize'>): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.phoneSearch.trim()) {
    query = query.ilike('phone_number', `%${filters.phoneSearch.trim()}%`);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', startOfDay(filters.dateFrom).toISOString());
  }
  if (filters.dateTo) {
    query = query.lte('created_at', endOfDay(filters.dateTo).toISOString());
  }
  if (filters.direction !== 'all') {
    query = query.eq('direction', filters.direction);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching conversations for export:', error);
    throw error;
  }

  return data || [];
}

export function useConversations(filters: ConversationFilters) {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => fetchConversations(filters),
  });
}

export function useConversationStats() {
  return useQuery({
    queryKey: ['conversation-stats'],
    queryFn: fetchConversationStats,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function exportConversationsToCSV(conversations: Conversation[]): void {
  const headers = ['Time', 'Phone', 'Direction', 'Type', 'Message', 'Tokens', 'Processing Time (ms)'];
  const rows = conversations.map((c) => [
    format(new Date(c.created_at), 'yyyy-MM-dd HH:mm:ss'),
    c.phone_number,
    c.direction,
    c.message_type,
    `"${(c.message_content || '').replace(/"/g, '""')}"`,
    c.llm_tokens_used,
    c.processing_time_ms || '',
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `conversations_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export { fetchAllConversationsForExport };
