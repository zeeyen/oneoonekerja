import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HandoverWithDetails, HandoverStatus } from '@/types/database';
import { getStatusConfig, handoverStatusConfig } from '@/lib/statusConfig';
import { useUpdateHandoverStatus, useUpdateHandoverNotes } from '@/hooks/useHandoverActions';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Copy,
  ExternalLink,
  User,
  Briefcase,
  Clock,
  MapPin,
  Phone,
  CreditCard,
  Loader2,
  UserCircle,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HandoverDetailModalProps {
  handover: HandoverWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

const ALL_STATUSES: HandoverStatus[] = [
  'pending_verification',
  'verified',
  'approved',
  'rejected',
  'interview_scheduled',
  'interviewed',
  'offer_made',
  'hired',
  'started_work',
  'dropped_out',
];

export function HandoverDetailModal({
  handover,
  open,
  onOpenChange,
  onUpdate,
}: HandoverDetailModalProps) {
  const { user } = useAuth();
  const updateStatusMutation = useUpdateHandoverStatus();
  const updateNotesMutation = useUpdateHandoverNotes();

  const [selectedStatus, setSelectedStatus] = useState<HandoverStatus | ''>('');
  const [staffNotes, setStaffNotes] = useState('');

  // Sync state when handover changes
  useEffect(() => {
    if (handover) {
      setSelectedStatus(handover.status);
      setStaffNotes(handover.staff_notes || '');
    }
  }, [handover]);

  if (!handover) return null;

  const statusConfig = getStatusConfig(handover.status);

  const copyToken = () => {
    navigator.clipboard.writeText(handover.eligibility_token);
    toast({ title: 'Copied!', description: 'Token copied to clipboard.' });
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === handover.status) return;

    try {
      await updateStatusMutation.mutateAsync({
        id: handover.id,
        status: selectedStatus,
        currentUserId: user?.id,
      });
      toast({ title: 'Success', description: 'Status updated successfully.' });
      onUpdate?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveNotes = async () => {
    try {
      await updateNotesMutation.mutateAsync({
        id: handover.id,
        notes: staffNotes,
      });
      toast({ title: 'Success', description: 'Notes saved successfully.' });
      onUpdate?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save notes.',
        variant: 'destructive',
      });
    }
  };

  const formatJobTypes = (types: string[] | undefined) => {
    if (!types || types.length === 0) return 'Not specified';
    return types
      .map((t) => (t === 'part_time' ? 'Part-time' : t === 'full_time' ? 'Full-time' : t))
      .join(', ');
  };

  const formatPositions = (positions: string[] | undefined) => {
    if (!positions || positions.length === 0) return 'Not specified';
    return positions.map((p) => p.replace('_', ' ')).join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            Handover Details
          </DialogTitle>
          {/* Token Display */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg mt-2">
            <div>
              <p className="text-xs text-muted-foreground">Eligibility Token</p>
              <p className="font-mono text-2xl font-bold tracking-wider">
                {handover.eligibility_token}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={copyToken}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="px-6 py-4 space-y-4">
            {/* User Summary Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Candidate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{handover.user?.full_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {handover.user?.phone_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">IC Number</p>
                    <p className="font-medium">
                      {handover.user?.ic_number || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {handover.user?.location_city && handover.user?.location_state
                        ? `${handover.user.location_city}, ${handover.user.location_state}`
                        : 'Not specified'}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Job Preferences</p>
                    <div className="flex flex-wrap gap-1">
                      {handover.user?.preferred_job_types?.map((type) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type === 'part_time' ? 'Part-time' : 'Full-time'}
                        </Badge>
                      ))}
                      {(!handover.user?.preferred_job_types ||
                        handover.user.preferred_job_types.length === 0) && (
                        <span className="text-sm text-muted-foreground">Not specified</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Positions</p>
                    <div className="flex flex-wrap gap-1">
                      {handover.user?.preferred_positions?.slice(0, 5).map((pos) => (
                        <Badge key={pos} variant="outline" className="text-xs capitalize">
                          {pos.replace('_', ' ')}
                        </Badge>
                      ))}
                      {handover.user?.preferred_positions &&
                        handover.user.preferred_positions.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{handover.user.preferred_positions.length - 5} more
                          </Badge>
                        )}
                      {(!handover.user?.preferred_positions ||
                        handover.user.preferred_positions.length === 0) && (
                        <span className="text-sm text-muted-foreground">Not specified</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Job Summary Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Job
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Job Title</p>
                    <p className="font-medium">{handover.job?.job_title || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Position</p>
                    <Badge variant="secondary" className="capitalize">
                      {handover.job?.position?.replace('_', ' ') || 'Unknown'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {handover.job?.location_city && handover.job?.location_state
                        ? `${handover.job.location_city}, ${handover.job.location_state}`
                        : 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hourly Rate</p>
                    <p className="font-medium flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      {handover.job?.hourly_rate ? `RM ${handover.job.hourly_rate}` : 'Not specified'}
                    </p>
                  </div>
                </div>
                {handover.whatsapp_group_link && (
                  <>
                    <Separator />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => window.open(handover.whatsapp_group_link, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open WhatsApp Group
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Status Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Current:</span>
                  <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={selectedStatus}
                    onValueChange={(v) => setSelectedStatus(v as HandoverStatus)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Change status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {ALL_STATUSES.map((status) => {
                        const config = handoverStatusConfig[status];
                        return (
                          <SelectItem key={status} value={status}>
                            {config.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={
                      updateStatusMutation.isPending ||
                      !selectedStatus ||
                      selectedStatus === handover.status
                    }
                  >
                    {updateStatusMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Update
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Staff Notes Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Staff Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Add notes about this candidate..."
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  rows={3}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={updateNotesMutation.isPending}
                  className="w-full"
                >
                  {updateNotesMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Notes
                </Button>
              </CardContent>
            </Card>

            {/* Timeline Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(handover.created_at), 'PPP p')}
                        <span className="ml-2">
                          ({formatDistanceToNow(new Date(handover.created_at), { addSuffix: true })})
                        </span>
                      </p>
                    </div>
                  </div>
                  {handover.verified_at && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Verified</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(handover.verified_at), 'PPP p')}
                          {handover.verified_by && (
                            <span className="ml-2 flex items-center gap-1 inline">
                              <UserCircle className="h-3 w-3 inline" />
                              by staff
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Last Updated</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(handover.updated_at), 'PPP p')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between">
          <Button variant="outline" asChild>
            <Link to={`/applicants/${handover.user_id}`} onClick={() => onOpenChange(false)}>
              <UserCircle className="mr-2 h-4 w-4" />
              View Full Profile
            </Link>
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
