import { useState } from 'react';
import type { Applicant } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { BanModal } from '@/components/BanModal';
import { useBanApplicant, useUnbanApplicant } from '@/hooks/useModeration';
import { ShieldAlert, ShieldCheck, Clock, FileText, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ModerationSectionProps {
  applicant: Applicant;
}

export function ModerationSection({ applicant }: ModerationSectionProps) {
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banMode, setBanMode] = useState<'ban' | 'extend'>('ban');
  const [unbanConfirmOpen, setUnbanConfirmOpen] = useState(false);

  const banMutation = useBanApplicant();
  const unbanMutation = useUnbanApplicant();

  const isBanned = applicant.banned_until && new Date(applicant.banned_until) > new Date();

  const handleBan = (duration: string, reason: string, customDate?: Date) => {
    banMutation.mutate(
      {
        applicantId: applicant.id,
        duration,
        customDate,
        reason,
        previousBanUntil: applicant.banned_until,
        actionType: banMode === 'ban' ? 'ban' : 'extend_ban',
      },
      { onSuccess: () => setBanModalOpen(false) }
    );
  };

  const handleUnban = () => {
    setUnbanConfirmOpen(false);
    unbanMutation.mutate({
      applicantId: applicant.id,
      previousBanUntil: applicant.banned_until,
    });
  };

  return (
    <>
      <Card className="shadow-sm border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Moderation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isBanned ? (
            <div className="space-y-4">
              <Badge variant="destructive" className="text-sm">Currently Banned</Badge>

              <div className="space-y-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Banned until</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(applicant.banned_until!), 'PPpp')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Time remaining</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(applicant.banned_until!), { addSuffix: false })}
                    </p>
                  </div>
                </div>
                {applicant.ban_reason && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Reason</p>
                      <p className="text-sm text-muted-foreground">{applicant.ban_reason}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setUnbanConfirmOpen(true)}
                  disabled={unbanMutation.isPending}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                >
                  {unbanMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Unban User
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => { setBanMode('extend'); setBanModalOpen(true); }}
                >
                  Extend Ban
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This user is not currently banned. Violations: {applicant.violation_count}
              </p>
              <Button
                variant="destructive"
                onClick={() => { setBanMode('ban'); setBanModalOpen(true); }}
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                Ban User
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <BanModal
        open={banModalOpen}
        onOpenChange={setBanModalOpen}
        onConfirm={handleBan}
        isPending={banMutation.isPending}
        mode={banMode}
        defaultReason={banMode === 'extend' ? (applicant.ban_reason ?? '') : ''}
      />

      <AlertDialog open={unbanConfirmOpen} onOpenChange={setUnbanConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unban User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unban {applicant.full_name || 'this user'}?
              They will be able to use the service immediately.
              Violation count ({applicant.violation_count}) will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnban}>Unban</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
