import type { Applicant } from '@/types/database';

type OnboardingStatus = Applicant['onboarding_status'];

interface StatusConfig {
  label: string;
  className: string;
}

export const onboardingStatusConfig: Record<OnboardingStatus, StatusConfig> = {
  new: {
    label: 'New',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
  },
};

export function getOnboardingStatusConfig(status: OnboardingStatus): StatusConfig {
  return onboardingStatusConfig[status] || onboardingStatusConfig.new;
}
