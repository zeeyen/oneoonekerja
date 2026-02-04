import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/types/database';
import { INDUSTRY_OPTIONS } from './useJobs';

export { INDUSTRY_OPTIONS };

export interface JobFormData {
  title: string;
  company: string;
  location_state: string;
  location_city: string;
  min_experience_years: number;
  salary_range: string;
  gender_requirement: 'any' | 'male' | 'female';
  industry: string;
  url: string;
  expire_by: string; // date string YYYY-MM-DD
  min_age: number | null;
  max_age: number | null;
}

export const defaultJobFormData: JobFormData = {
  title: '',
  company: '',
  location_state: '',
  location_city: '',
  min_experience_years: 0,
  salary_range: '',
  gender_requirement: 'any',
  industry: '',
  url: '',
  expire_by: '',
  min_age: null,
  max_age: null,
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
    .insert(formData)
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
