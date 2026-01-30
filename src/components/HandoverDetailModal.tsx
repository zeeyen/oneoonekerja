import { HandoverWithDetails } from '@/types/database';
import { getStatusConfig } from '@/lib/statusConfig';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Copy, ExternalLink, User, Briefcase, Clock, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface HandoverDetailModalProps {
  handover: HandoverWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HandoverDetailModal({ handover, open, onOpenChange }: HandoverDetailModalProps) {
  if (!handover) return null;

  const statusConfig = getStatusConfig(handover.status);

  const copyToken = () => {
    navigator.clipboard.writeText(handover.eligibility_token);
    toast({ title: 'Copied!', description: 'Token copied to clipboard.' });
  };

  const openWhatsApp = () => {
    window.open(handover.whatsapp_group_link, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Handover Details
            <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
          </DialogTitle>
          <DialogDescription>
            Token: <span className="font-mono font-bold">{handover.eligibility_token}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Token Section */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Eligibility Token</p>
              <p className="font-mono text-2xl font-bold tracking-wider">
                {handover.eligibility_token}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={copyToken}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          {/* User Info */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Candidate</p>
              <p className="font-medium">{handover.user?.full_name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{handover.user?.phone_number}</p>
            </div>
          </div>

          {/* Job Info */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Job</p>
              <p className="font-medium">{handover.job?.job_title || 'Unknown Job'}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {handover.job?.position?.replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">
                {formatDistanceToNow(new Date(handover.created_at), { addSuffix: true })}
              </p>
              {handover.verified_at && (
                <p className="text-sm text-muted-foreground">
                  Verified {formatDistanceToNow(new Date(handover.verified_at), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>

          {/* Staff Notes */}
          {handover.staff_notes && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Staff Notes</p>
                <p className="font-medium">{handover.staff_notes}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={openWhatsApp}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open WhatsApp Group
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
