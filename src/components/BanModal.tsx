import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface BanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (duration: string, reason: string, customDate?: Date) => void;
  isPending: boolean;
  mode: 'ban' | 'extend';
  defaultReason?: string;
}

const DURATION_OPTIONS = [
  { value: '24_hours', label: '24 hours' },
  { value: '72_hours', label: '72 hours' },
  { value: '7_days', label: '7 days' },
  { value: '30_days', label: '30 days' },
  { value: 'custom', label: 'Custom' },
];

export function BanModal({ open, onOpenChange, onConfirm, isPending, mode, defaultReason = '' }: BanModalProps) {
  const [duration, setDuration] = useState('7_days');
  const [reason, setReason] = useState(defaultReason);
  const [customDate, setCustomDate] = useState<Date | undefined>(addDays(new Date(), 7));

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(duration, reason.trim(), customDate);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setDuration('7_days');
      setReason(defaultReason);
      setCustomDate(addDays(new Date(), 7));
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">
            {mode === 'ban' ? 'Ban User' : 'Extend Ban'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {duration === 'custom' && (
            <div className="space-y-2">
              <Label>Ban end date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !customDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate ? format(customDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={setCustomDate}
                    disabled={(date) => date <= new Date()}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Repeated inappropriate messages"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending || !reason.trim()}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'ban' ? 'Confirm Ban' : 'Extend Ban'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
