import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

export type AdminRole = 'admin' | 'staff';

interface AdminContextType {
  role: AdminRole | null;
  isAdmin: boolean;
  isStaff: boolean;
  isActive: boolean;
  fullName: string | null;
  loading: boolean;
  accessDenied: boolean;
  checkAdminAccess: () => Promise<boolean>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const checkAdminAccess = useCallback(async (): Promise<boolean> => {
    if (!user?.email) {
      setRole(null);
      setIsActive(false);
      setFullName(null);
      setAccessDenied(false);
      setLoading(false);
      return false;
    }

    try {
      // Check if user exists in admin_users table by their auth user id
      const { data, error } = await supabase
        .from('admin_users')
        .select('role, is_active, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking admin access:', error);
        setAccessDenied(true);
        setLoading(false);
        return false;
      }

      if (!data) {
        // User not found in admin_users table
        setAccessDenied(true);
        setRole(null);
        setIsActive(false);
        setFullName(null);
        setLoading(false);
        return false;
      }

      if (!data.is_active) {
        // User is deactivated
        setAccessDenied(true);
        setRole(null);
        setIsActive(false);
        setFullName(data.full_name);
        setLoading(false);
        return false;
      }

      // User is valid admin/staff
      setRole(data.role as AdminRole);
      setIsActive(data.is_active);
      setFullName(data.full_name);
      setAccessDenied(false);
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Error checking admin access:', err);
      setAccessDenied(true);
      setLoading(false);
      return false;
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        checkAdminAccess();
      } else {
        setRole(null);
        setIsActive(false);
        setFullName(null);
        setAccessDenied(false);
        setLoading(false);
      }
    }
  }, [user, authLoading, checkAdminAccess]);

  return (
    <AdminContext.Provider
      value={{
        role,
        isAdmin: role === 'admin',
        isStaff: role === 'staff',
        isActive,
        fullName,
        loading: authLoading || loading,
        accessDenied,
        checkAdminAccess,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
