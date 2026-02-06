import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { AdminAction } from '@/types/database';
import { addHours, addDays } from 'date-fns';

export interface BanPayload {
  applicantId: string;
  duration: string;
  customDate?: Date;
  reason: string;
  previousBanUntil?: string | null;
  actionType: 'ban' | 'extend_ban';
}

function calculateBanEnd(duration: string, customDate?: Date): string {
  const now = new Date();
  switch (duration) {
    case '24_hours': return addHours(now, 24).toISOString();
    case '72_hours': return addHours(now, 72).toISOString();
    case '7_days': return addDays(now, 7).toISOString();
    case '30_days': return addDays(now, 30).toISOString();
    case 'custom': return customDate?.toISOString() ?? addDays(now, 7).toISOString();
    default: return addDays(now, 7).toISOString();
  }
}

export function useBanApplicant() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: BanPayload) => {
      const bannedUntil = calculateBanEnd(payload.duration, payload.customDate);

      const { error: updateError } = await supabase
        .from('applicants')
        .update({ banned_until: bannedUntil, ban_reason: payload.reason })
        .eq('id', payload.applicantId);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: payload.actionType,
          target_user_id: payload.applicantId,
          details: {
            reason: payload.reason,
            duration: payload.duration,
            previous_ban_until: payload.previousBanUntil ?? null,
          },
        });

      if (logError) console.error('Failed to log admin action:', logError);
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ['applicant', payload.applicantId] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions', payload.applicantId] });
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
      toast({
        title: payload.actionType === 'ban' ? 'User banned' : 'Ban extended',
        description: `Ban has been applied successfully.`,
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to apply ban.', variant: 'destructive' });
    },
  });
}

export function useUnbanApplicant() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ applicantId, previousBanUntil }: { applicantId: string; previousBanUntil: string | null }) => {
      const { error: updateError } = await supabase
        .from('applicants')
        .update({ banned_until: null, ban_reason: null })
        .eq('id', applicantId);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: 'unban',
          target_user_id: applicantId,
          details: { previous_ban_until: previousBanUntil },
        });

      if (logError) console.error('Failed to log admin action:', logError);
    },
    onSuccess: (_, { applicantId }) => {
      queryClient.invalidateQueries({ queryKey: ['applicant', applicantId] });
      queryClient.invalidateQueries({ queryKey: ['admin-actions', applicantId] });
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
      toast({ title: 'User unbanned', description: 'The ban has been lifted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to unban user.', variant: 'destructive' });
    },
  });
}

export function useAdminActions(targetUserId: string) {
  return useQuery({
    queryKey: ['admin-actions', targetUserId],
    queryFn: async (): Promise<AdminAction[]> => {
      const { data, error } = await supabase
        .from('admin_actions')
        .select('*')
        .eq('target_user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin actions:', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!targetUserId,
  });
}
