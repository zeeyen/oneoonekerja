import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AdminUser, Applicant, Job } from '@/types/database';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// Fetch all admin users
async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching admin users:', error);
    throw error;
  }

  return data || [];
}

// Create a new admin user
async function createAdminUser(adminData: {
  email: string;
  full_name: string;
  role: 'admin' | 'staff';
}): Promise<AdminUser> {
  const { data, error } = await supabase
    .from('admin_users')
    .insert({
      ...adminData,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }

  return data;
}

// Update admin user role
async function updateAdminRole(params: {
  id: string;
  role: 'admin' | 'staff';
}): Promise<AdminUser> {
  const { data, error } = await supabase
    .from('admin_users')
    .update({ role: params.role })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating admin role:', error);
    throw error;
  }

  return data;
}

// Toggle admin user active status
async function toggleAdminStatus(params: {
  id: string;
  is_active: boolean;
}): Promise<AdminUser> {
  const { data, error } = await supabase
    .from('admin_users')
    .update({ is_active: params.is_active })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error toggling admin status:', error);
    throw error;
  }

  return data;
}

// Fetch system stats
interface SystemStats {
  totalApplicants: number;
  messagesThisMonth: number;
  tokensThisMonth: number;
  handoversByStatus: Record<string, number>;
}

async function fetchSystemStats(): Promise<SystemStats> {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  // Fetch total applicants
  const { count: totalApplicants } = await supabase
    .from('applicants')
    .select('*', { count: 'exact', head: true });

  // Fetch messages and tokens this month
  const { data: messagesData } = await supabase
    .from('conversations')
    .select('llm_tokens_used')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd);

  const messagesThisMonth = messagesData?.length || 0;
  const tokensThisMonth = messagesData?.reduce((sum, m) => sum + (m.llm_tokens_used || 0), 0) || 0;

  // Fetch handovers by status
  const { data: handoversData } = await supabase
    .from('handovers')
    .select('status');

  const handoversByStatus: Record<string, number> = {};
  handoversData?.forEach((h) => {
    handoversByStatus[h.status] = (handoversByStatus[h.status] || 0) + 1;
  });

  return {
    totalApplicants: totalApplicants || 0,
    messagesThisMonth,
    tokensThisMonth,
    handoversByStatus,
  };
}

// Fetch all applicants for export
async function fetchAllApplicantsForExport(): Promise<Applicant[]> {
  const { data, error } = await supabase
    .from('applicants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching applicants for export:', error);
    throw error;
  }

  return data || [];
}

// Fetch all jobs for export
async function fetchAllJobsForExport(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching jobs for export:', error);
    throw error;
  }

  return data || [];
}

// Export functions
export function exportApplicantsToCSV(applicants: Applicant[]): void {
  const headers = [
    'ID', 'Phone', 'IC', 'Name', 'Age', 'Gender', 'Language',
    'City', 'State', 'Postcode', 'Job Types', 'Positions',
    'Years Exp', 'Has Transport', 'Transport Type', 'OKU',
    'Onboarding Status', 'Is Active', 'Created At',
  ];
  const rows = applicants.map((a) => [
    a.id,
    a.phone_number,
    a.ic_number || '',
    a.full_name || '',
    a.age || '',
    a.gender || '',
    a.preferred_language,
    a.location_city || '',
    a.location_state || '',
    a.location_postcode || '',
    a.preferred_job_types?.join(';') || '',
    a.preferred_positions?.join(';') || '',
    a.years_experience,
    a.has_transport ? 'Yes' : 'No',
    a.transport_type || '',
    a.is_oku ? 'Yes' : 'No',
    a.onboarding_status,
    a.is_active ? 'Yes' : 'No',
    format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss'),
  ]);

  downloadCSV(headers, rows, 'applicants');
}

export function exportJobsToCSV(jobs: Job[]): void {
  const headers = [
    'ID', 'Job Title', 'Position', 'Job Type', 'Branch',
    'City', 'State', 'Postcode', 'Gender Req', 'Age Min', 'Age Max',
    'OKU Friendly', 'Hourly Rate', 'Slots', 'Start Date', 'End Date',
    'Is Active', 'Created At',
  ];
  const rows = jobs.map((j) => [
    j.id,
    `"${j.job_title.replace(/"/g, '""')}"`,
    j.position,
    j.job_type === 1 ? 'Part-time' : j.job_type === 2 ? 'Full-time' : '',
    j.branch_name || '',
    j.location_city || '',
    j.location_state || '',
    j.location_postcode || '',
    j.gender_requirement,
    j.age_min || '',
    j.age_max || '',
    j.is_oku_friendly ? 'Yes' : 'No',
    j.hourly_rate || '',
    j.slots_available,
    j.start_date || '',
    j.end_date || '',
    j.is_active ? 'Yes' : 'No',
    format(new Date(j.created_at), 'yyyy-MM-dd HH:mm:ss'),
  ]);

  downloadCSV(headers, rows, 'jobs');
}

function downloadCSV(headers: string[], rows: (string | number)[][], filename: string): void {
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Hooks
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchAdminUsers,
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useUpdateAdminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useToggleAdminStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleAdminStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useSystemStats() {
  return useQuery({
    queryKey: ['system-stats'],
    queryFn: fetchSystemStats,
  });
}

export { fetchAllApplicantsForExport, fetchAllJobsForExport };
