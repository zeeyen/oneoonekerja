import { format } from 'date-fns';
import type { Applicant } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, FileText } from 'lucide-react';

interface BanDetailsDialogProps {
  applicant: Applicant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BanDetailsDialog({ applicant, open, onOpenChange }: BanDetailsDialogProps) {
  if (!applicant) return null;

  return (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}