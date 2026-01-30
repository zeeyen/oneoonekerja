import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type AdminRole = 'admin' | 'staff' | null;

interface AdminUserData {
  role: AdminRole;
  isActive: boolean;
  fullName: string | null;
}

export function useAdminUser() {
  const { user } = useAuth();
  const [adminData, setAdminData] = useState<AdminUserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdminUser() {
      if (!user) {
        setAdminData(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('role, is_active, full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching admin user:', error);
          setAdminData(null);
        } else if (data && data.is_active) {
          setAdminData({
            role: data.role as AdminRole,
            isActive: data.is_active,
            fullName: data.full_name,
          });
        } else {
          setAdminData(null);
        }
      } catch (err) {
        console.error('Error fetching admin user:', err);
        setAdminData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchAdminUser();
  }, [user]);

  return {
    role: adminData?.role ?? null,
    isAdmin: adminData?.role === 'admin',
    isStaff: adminData?.role === 'staff',
    isActive: adminData?.isActive ?? false,
    fullName: adminData?.fullName ?? null,
    loading,
  };
}
