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
  matching: {
    label: 'Matching',
    className: 'bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
  },
};

export const bannedStatusConfig: StatusConfig = {
  label: 'Banned',
  className: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200',
};

export function isApplicantBanned(applicant: Applicant): boolean {
  if (!applicant.banned_until) return false;
  return new Date(applicant.banned_until) > new Date();
}

export function getOnboardingStatusConfig(status: OnboardingStatus): StatusConfig {
  return onboardingStatusConfig[status] || onboardingStatusConfig.new;
}

export function getApplicantStatusConfig(applicant: Applicant): StatusConfig & { isBanned: boolean } {
  if (isApplicantBanned(applicant)) {
    return { ...bannedStatusConfig, isBanned: true };
  }
  return { ...getOnboardingStatusConfig(applicant.onboarding_status), isBanned: false };
}
