import { useState } from 'react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Applicant } from '@/types/database';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, FileText, Loader2, UserCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BanDetailsDialogProps {
  applicant: Applicant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function unbanApplicant(applicantId: string) {
  const { error } = await supabase
    .from('applicants')
    .update({
      banned_until: null,
      ban_reason: null,
    })
    .eq('id', applicantId);

  if (error) throw error;
}

export function BanDetailsDialog({ applicant, open, onOpenChange }: BanDetailsDialogProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const unbanMutation = useMutation({
    mutationFn: () => unbanApplicant(applicant!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
      toast({
        title: 'Applicant unbanned',
        description: `${applicant?.full_name || 'Applicant'} has been unbanned successfully.`,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to unban applicant. Please try again.',
        variant: 'destructive',
      });
    },
  });

  if (!applicant) return null;

  const isBanned = applicant.banned_until && new Date(applicant.banned_until) > new Date();

  const handleUnban = () => {
    setConfirmOpen(false);
    unbanMutation.mutate();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Ban Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Applicant</p>
              <p className="text-lg font-semibold">{applicant.full_name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground font-mono">{applicant.phone_number}</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-sm">
                {applicant.violation_count} violation{applicant.violation_count !== 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Ban Expires</p>
                  <p className="text-sm text-muted-foreground">
                    {applicant.banned_until
                      ? format(new Date(applicant.banned_until), 'PPpp')
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Reason</p>
                  <p className="text-sm text-muted-foreground">
                    {applicant.ban_reason || 'No reason provided'}
                  </p>
                </div>
              </div>
            </div>

            {isBanned && (
              <div className="pt-4 border-t">
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={unbanMutation.isPending}
                  className="w-full"
                >
                  {unbanMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="mr-2 h-4 w-4" />
                  )}
                  Unban Applicant
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unban Applicant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unban {applicant.full_name || 'this applicant'}? 
              They will be able to use the service again immediately. 
              The violation count ({applicant.violation_count}) will be preserved for history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnban}>
              Unban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}