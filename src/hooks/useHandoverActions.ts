import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { HandoverStatus } from '@/types/database';

interface UpdateStatusParams {
  id: string;
  status: HandoverStatus;
  currentUserId?: string;
}

interface UpdateNotesParams {
  id: string;
  notes: string;
}

async function updateHandoverStatus({ id, status, currentUserId }: UpdateStatusParams) {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  // If changing to 'verified', set verified_at and verified_by
  if (status === 'verified') {
    updateData.verified_at = new Date().toISOString();
    if (currentUserId) {
      updateData.verified_by = currentUserId;
    }
  }

  const { data, error } = await supabase
    .from('handovers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating handover status:', error);
    throw error;
  }

  return data;
}

async function updateHandoverNotes({ id, notes }: UpdateNotesParams) {
  const { data, error } = await supabase
    .from('handovers')
    .update({
      staff_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating handover notes:', error);
    throw error;
  }

  return data;
}

export function useUpdateHandoverStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateHandoverStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      queryClient.invalidateQueries({ queryKey: ['handover-counts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-handovers-count'] });
    },
  });
}

export function useUpdateHandoverNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateHandoverNotes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
    },
  });
}
