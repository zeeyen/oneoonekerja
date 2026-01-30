import type { HandoverStatus } from '@/types/database';

interface StatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}

export const handoverStatusConfig: Record<HandoverStatus, StatusConfig> = {
  pending_verification: {
    label: 'Pending Verification',
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200',
  },
  verified: {
    label: 'Verified',
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200',
  },
  approved: {
    label: 'Approved',
    variant: 'secondary',
    className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200',
  },
  interview_scheduled: {
    label: 'Interview Scheduled',
    variant: 'secondary',
    className: 'bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200',
  },
  interviewed: {
    label: 'Interviewed',
    variant: 'secondary',
    className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-indigo-200',
  },
  offer_made: {
    label: 'Offer Made',
    variant: 'secondary',
    className: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100 border-cyan-200',
  },
  hired: {
    label: 'Hired',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
  },
  started_work: {
    label: 'Started Work',
    variant: 'secondary',
    className: 'bg-teal-100 text-teal-800 hover:bg-teal-100 border-teal-200',
  },
  dropped_out: {
    label: 'Dropped Out',
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200',
  },
};

export function getStatusConfig(status: HandoverStatus): StatusConfig {
  return handoverStatusConfig[status] || handoverStatusConfig.pending_verification;
}
