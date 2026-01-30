import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useCreateAdminUser } from '@/hooks/useSettings';
import { toast } from '@/hooks/use-toast';

interface AddAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAdminModal({ open, onOpenChange }: AddAdminModalProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');

  const createMutation = useCreateAdminUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({ title: 'Validation Error', description: 'Email is required.', variant: 'destructive' });
      return;
    }

    try {
      await createMutation.mutateAsync({
        email: email.trim(),
        full_name: fullName.trim(),
        role,
      });
      toast({ title: 'Success', description: 'Admin user created successfully.' });
      onOpenChange(false);
      setEmail('');
      setFullName('');
      setRole('staff');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create admin user. Make sure the email is unique.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Admin User</DialogTitle>
          <DialogDescription>
            Add a new admin or staff user to the dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'staff')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Admin
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
