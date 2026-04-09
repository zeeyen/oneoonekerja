import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ServerCrash, Download, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
  date: string;
  fileName: string;
  totalRows: number;
}

export function FtpImportModal({ open, onOpenChange }: Props) {
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yy}${mm}${dd}`;

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const fnUrl = `https://${projectId}.supabase.co/functions/v1/ftp-import-jobs?date=${dateStr}`;

      const resp = await fetch(fnUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
      });

      const json = await resp.json();

      if (!resp.ok) {
        setError(json.error || 'Import failed');
        return;
      }

      setResult(json as ImportResult);
      const parts: string[] = [];
      if (json.inserted > 0) parts.push(`${json.inserted} new`);
      if (json.updated > 0) parts.push(`${json.updated} updated`);
      toast({ title: 'FTP Import Complete', description: parts.join(', ') || 'No changes' });
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [date]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!loading) {
        onOpenChange(open);
        if (!open) {
          setResult(null);
          setError(null);
        }
      }
    },
    [loading, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ServerCrash className="h-5 w-5" />
            FTP Import
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Select a date to download and import the CSV from the FTP server.
            </p>
            <p className="text-xs text-muted-foreground">
              File format: <code className="bg-muted px-1 rounded">Jobs_YYMMDD.csv</code> from <code className="bg-muted px-1 rounded">/production/</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[200px] justify-start text-left font-normal',
                    !date && 'text-muted-foreground',
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>

            <code className="text-xs text-muted-foreground">
              Jobs_{String(date.getFullYear()).slice(-2)}
              {String(date.getMonth() + 1).padStart(2, '0')}
              {String(date.getDate()).padStart(2, '0')}.csv
            </code>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-md border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Import Complete — {result.fileName}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-green-100 text-green-800">{result.inserted} new</Badge>
                <Badge className="bg-blue-100 text-blue-800">{result.updated} updated</Badge>
                <Badge variant="secondary">{result.skipped} skipped</Badge>
                {result.errors > 0 && (
                  <Badge variant="destructive">{result.errors} errors</Badge>
                )}
                <Badge variant="outline">{result.totalRows} total rows</Badge>
              </div>
              {result.errorDetails.length > 0 && (
                <div className="text-xs text-destructive mt-2 space-y-1">
                  {result.errorDetails.map((e, i) => (
                    <p key={i}>• {e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          <Button onClick={handleImport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
