import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
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
import { Search, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TokenVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TokenVerificationModal({ open, onOpenChange }: TokenVerificationModalProps) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async () => {
    const trimmedToken = token.trim().toUpperCase();
    
    if (!trimmedToken) {
      toast({
        title: 'Token required',
        description: 'Please enter an eligibility token to search.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('handovers')
        .select('id, eligibility_token')
        .eq('eligibility_token', trimmedToken)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        onOpenChange(false);
        setToken('');
        navigate(`/handovers/${data.id}`);
      } else {
        toast({
          title: 'Token not found',
          description: `No handover found with token "${trimmedToken}".`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error searching token:', err);
      toast({
        title: 'Search failed',
        description: 'An error occurred while searching. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Eligibility Token</DialogTitle>
          <DialogDescription>
            Enter the 8-character eligibility token to find and verify a candidate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="token">Eligibility Token</Label>
            <Input
              id="token"
              placeholder="e.g., ABC12345"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              maxLength={8}
              className="font-mono text-lg tracking-wider uppercase"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
