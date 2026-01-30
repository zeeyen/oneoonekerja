import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/types/database';

export const POSITION_OPTIONS = [
  { value: 'cashier', label: 'Cashier' },
  { value: 'waiter', label: 'Waiter' },
  { value: 'cleaner', label: 'Cleaner' },
  { value: 'packer', label: 'Packer' },
  { value: 'driver', label: 'Driver' },
  { value: 'sorter', label: 'Sorter' },
  { value: 'promoter', label: 'Promoter' },
  { value: 'technician', label: 'Technician' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'general_worker', label: 'General Worker' },
  { value: 'other', label: 'Other' },
];

export interface JobFormData {
  job_title: string;
  position: string;
  job_type: number | null;
  hourly_rate: number | null;
  branch_name: string;
  location_city: string;
  location_state: string;
  location_postcode: string;
  gender_requirement: 'any' | 'male' | 'female';
  age_min: number | null;
  age_max: number | null;
  is_oku_friendly: boolean;
  num_shifts: number | null;
  start_date: string | null;
  end_date: string | null;
  slots_available: number;
  whatsapp_group_link: string;
}

export const defaultJobFormData: JobFormData = {
  job_title: '',
  position: '',
  job_type: 1,
  hourly_rate: null,
  branch_name: '',
  location_city: '',
  location_state: '',
  location_postcode: '',
  gender_requirement: 'any',
  age_min: null,
  age_max: null,
  is_oku_friendly: false,
  num_shifts: null,
  start_date: null,
  end_date: null,
  slots_available: 10,
  whatsapp_group_link: '',
};

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

async function createJob(formData: JobFormData): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      ...formData,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating job:', error);
    throw error;
  }

  return data;
}

async function updateJob(id: string, formData: JobFormData): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating job:', error);
    throw error;
  }

  return data;
}

export function useJobById(id: string | undefined) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => fetchJobById(id!),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-active-count'] });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: JobFormData }) =>
      updateJob(id, formData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs-active-count'] });
    },
  });
}
