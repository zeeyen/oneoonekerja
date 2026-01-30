import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function usePendingHandoversCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCount() {
      try {
        const { count: pendingCount, error } = await supabase
          .from('handovers')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_verification');

        if (error) {
          console.error('Error fetching pending handovers count:', error);
          setCount(0);
        } else {
          setCount(pendingCount ?? 0);
        }
      } catch (err) {
        console.error('Error fetching pending handovers count:', err);
        setCount(0);
      } finally {
        setLoading(false);
      }
    }

    fetchCount();

    // Subscribe to realtime updates for handovers table
    const channel = supabase
      .channel('handovers-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'handovers',
        },
        () => {
          // Refetch count on any change
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { count, loading };
}
