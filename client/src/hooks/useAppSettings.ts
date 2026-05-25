import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  ANNUAL_SANDWICH_GOAL_KEY,
  DEFAULT_ANNUAL_SANDWICH_GOAL,
} from '@shared/schema';

export function useAppSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['/api/app-settings'],
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnnualSandwichGoal(): number {
  const { data } = useAppSettings();
  const raw = data?.[ANNUAL_SANDWICH_GOAL_KEY];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_ANNUAL_SANDWICH_GOAL;
}

export function useUpdateAppSetting() {
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest('PATCH', `/api/app-settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
    },
  });
}
