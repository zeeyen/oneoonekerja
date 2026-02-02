import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import {
  useAdminUsers,
  useUpdateAdminRole,
  useToggleAdminStatus,
  useSystemStats,
  fetchAllUsersForExport,
  fetchAllJobsForExport,
  exportUsersToCSV,
  exportJobsToCSV,
} from '@/hooks/useSettings';
import { AddAdminModal } from '@/components/AddAdminModal';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { getStatusConfig } from '@/lib/statusConfig';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  MessageSquare,
  Zap,
  FileCheck,
  Download,
  Plus,
  Loader2,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { HandoverStatus } from '@/types/database';

export default function SettingsPage() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  const { data: adminUsers, isLoading: adminsLoading } = useAdminUsers();
  const { data: stats, isLoading: statsLoading } = useSystemStats();
  const updateRoleMutation = useUpdateAdminRole();
  const toggleStatusMutation = useToggleAdminStatus();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [exportingUsers, setExportingUsers] = useState(false);
  const [exportingJobs, setExportingJobs] = useState(false);

  const handleRoleChange = async (adminId: string, newRole: 'admin' | 'staff') => {
    try {
      await updateRoleMutation.mutateAsync({ id: adminId, role: newRole });
      toast({ title: 'Success', description: 'Role updated successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update role.', variant: 'destructive' });
    }
  };

  const handleStatusToggle = async (adminId: string, currentStatus: boolean) => {
    if (adminId === user?.id) {
      toast({
        title: 'Action Not Allowed',
        description: 'You cannot deactivate yourself.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await toggleStatusMutation.mutateAsync({ id: adminId, is_active: !currentStatus });
      toast({ title: 'Success', description: 'Status updated successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    }
  };

  const handleExportUsers = async () => {
    setExportingUsers(true);
    try {
      const users = await fetchAllUsersForExport();
      exportUsersToCSV(users);
      toast({ title: 'Success', description: `Exported ${users.length} users.` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export users.', variant: 'destructive' });
    } finally {
      setExportingUsers(false);
    }
  };

  const handleExportJobs = async () => {
    setExportingJobs(true);
    try {
      const jobs = await fetchAllJobsForExport();
      exportJobsToCSV(jobs);
      toast({ title: 'Success', description: `Exported ${jobs.length} jobs.` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export jobs.', variant: 'destructive' });
    } finally {
      setExportingJobs(false);
    }
  };


  const handoverStatuses: HandoverStatus[] = [
    'pending_verification',
    'verified',
    'approved',
    'hired',
    'started_work',
    'dropped_out',
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage admin users and view system statistics.</p>
        </div>
      </div>

      {/* System Statistics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">System Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalUsers.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Messages This Month
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.messagesThisMonth.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tokens This Month
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.tokensThisMonth.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Handovers by Status
              </CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {handoverStatuses.map((status) => {
                    const count = stats?.handoversByStatus[status] || 0;
                    if (count === 0) return null;
                    const config = getStatusConfig(status);
                    return (
                      <Badge key={status} variant="outline" className={config.className}>
                        {count}
                      </Badge>
                    );
                  })}
                  {Object.keys(stats?.handoversByStatus || {}).length === 0 && (
                    <span className="text-sm text-muted-foreground">No handovers</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admin Users Management */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Admin Users</h2>
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Admin
          </Button>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-0">
            {adminsLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !adminUsers?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mb-4 opacity-20" />
                <p>No admin users found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminUsers.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.email}</TableCell>
                      <TableCell>{admin.full_name || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={admin.role}
                          onValueChange={(v) => handleRoleChange(admin.id, v as 'admin' | 'staff')}
                          disabled={updateRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-50">
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={admin.is_active}
                            onCheckedChange={() => handleStatusToggle(admin.id, admin.is_active)}
                            disabled={admin.id === user?.id || toggleStatusMutation.isPending}
                          />
                          <span className={admin.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                            {admin.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(admin.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Account Security */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Account Security</h2>
        <div className="max-w-md">
          <ChangePasswordCard />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="outline" onClick={handleExportUsers} disabled={exportingUsers}>
            {exportingUsers ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export All Users
          </Button>
          <Button variant="outline" onClick={handleExportJobs} disabled={exportingJobs}>
            {exportingJobs ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export All Jobs
          </Button>
        </div>
      </div>

      {/* Add Admin Modal */}
      <AddAdminModal open={addModalOpen} onOpenChange={setAddModalOpen} />
    </div>
  );
}
