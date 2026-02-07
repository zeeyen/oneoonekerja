import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UnresolvedJob {
  id: string;
  location_city: string | null;
  location_state: string | null;
  location_address: string | null;
  postcode: string | null;
  country: string | null;
}

interface BackfillProgress {
  current: number;
  total: number;
  resolved: number;
  failed: number;
}

export function useUnresolvedJobsCount() {
  return useQuery({
    queryKey: ['unresolved-jobs-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .is('latitude', null)
        .or('location_address.neq.null,location_city.neq.null,postcode.neq.null');

      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useBackfillGeocode() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BackfillProgress | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const run = useCallback(async () => {
    setIsRunning(true);

    try {
      // Fetch all unresolved jobs
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, location_city, location_state, location_address, postcode, country')
        .is('latitude', null)
        .or('location_address.neq.null,location_city.neq.null,postcode.neq.null');

      if (error) throw error;
      if (!jobs || jobs.length === 0) {
        toast({ title: 'No unresolved jobs found' });
        setIsRunning(false);
        return;
      }

      const total = jobs.length;
      let resolved = 0;
      let failed = 0;

      setProgress({ current: 0, total, resolved: 0, failed: 0 });

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i] as UnresolvedJob;

        try {
          const { data, error: fnError } = await supabase.functions.invoke('geocode-location', {
            body: {
              city: job.location_city,
              state: job.location_state,
              location_address: job.location_address,
              postcode: job.postcode,
              country: job.country || 'Malaysia',
            },
          });

          if (fnError) {
            // Check for rate limit / payment errors
            const status = (fnError as any)?.status;
            if (status === 429 || status === 402) {
              toast({
                title: 'Rate limited',
                description: `Stopped after ${i} of ${total} jobs. Try again later.`,
                variant: 'destructive',
              });
              failed += total - i;
              break;
            }
            failed++;
          } else if (data?.latitude && data?.longitude) {
            await supabase
              .from('jobs')
              .update({ latitude: data.latitude, longitude: data.longitude })
              .eq('id', job.id);
            resolved++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }

        setProgress({ current: i + 1, total, resolved, failed });

        // Throttle: 200ms delay between calls
        if (i < jobs.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      toast({
        title: 'Backfill complete',
        description: `Resolved ${resolved}/${total} jobs. ${failed} could not be resolved.`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['unresolved-jobs-count'] });
    } catch (e) {
      toast({
        title: 'Backfill failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }, [toast, queryClient]);

  return { run, isRunning, progress };
}
