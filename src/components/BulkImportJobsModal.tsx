import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Download, CheckCircle2, AlertTriangle, XCircle, FileText, Sparkles, Ban } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useBulkImportJobs,
  parseCsvContent,
  generateCsvTemplate,
  type ParsedRow,
} from '@/hooks/useBulkImportJobs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkImportJobsModal({ open, onOpenChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const {
    fetchLocations, fetchExistingJobIds, locationsLoaded, processRows,
    resolveWithAi, aiResolving, aiProgress,
    importRows, importing, progress,
  } = useBulkImportJobs();

  useEffect(() => {
    if (open) {
      fetchLocations();
      setParsedRows([]);
      setParseError(null);
      setFileName(null);
    }
  }, [open, fetchLocations]);

  const handleDownloadTemplate = useCallback(() => {
    const csv = generateCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jobs_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      const content = await file.text();
      const { rows, headerError } = parseCsvContent(content);
      if (headerError) {
        setParseError(headerError);
        setParsedRows([]);
        return;
      }
      setParseError(null);

      const existingIds = await fetchExistingJobIds();
      setParsedRows(processRows(rows, existingIds));
    },
    [processRows, fetchExistingJobIds],
  );

  const handleAiResolve = useCallback(async () => {
    const updated = await resolveWithAi(parsedRows);
    setParsedRows(updated);
    const aiResolved = updated.filter((r) => r.resolutionMethod === 'ai').length;
    if (aiResolved > 0) {
      toast({ title: 'AI Resolution', description: `Resolved ${aiResolved} locations via AI.` });
    } else {
      toast({ title: 'AI Resolution', description: 'No additional locations could be resolved.' });
    }
  }, [resolveWithAi, parsedRows]);

  const newCount = parsedRows.filter((r) => r.errors.length === 0 && !r.isExisting).length;
  const existingCount = parsedRows.filter((r) => r.isExisting).length;
  const errorCount = parsedRows.filter((r) => r.errors.length > 0).length;
  const unresolvedCount = parsedRows.filter((r) => !r.locationResolved && r.errors.length === 0 && !r.isExisting).length;
  const aiResolvedCount = parsedRows.filter((r) => r.resolutionMethod === 'ai').length;
  const localResolvedCount = parsedRows.filter((r) => r.resolutionMethod === 'local').length;

  const handleImport = useCallback(async () => {
    try {
      const result = await importRows(parsedRows);
      toast({
        title: 'Import complete',
        description: `${result.inserted} new jobs imported. ${result.skipped > 0 ? `${result.skipped} existing skipped.` : ''} ${result.locationWarnings > 0 ? `${result.locationWarnings} without coordinates.` : ''}`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Import failed',
        description: err.message || 'An error occurred during import.',
        variant: 'destructive',
      });
    }
  }, [importRows, parsedRows, onOpenChange]);

  const busy = importing || aiResolving;

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Jobs</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0">
          {/* Actions row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !locationsLoaded}
            >
              <Upload className="h-4 w-4 mr-2" />
              {locationsLoaded ? 'Upload CSV' : 'Loading locations...'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            {fileName && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {fileName}
              </span>
            )}
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {parseError}
            </div>
          )}

          {/* Summary badges */}
          {parsedRows.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{parsedRows.length} rows</Badge>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {newCount} new
              </Badge>
              {existingCount > 0 && (
                <Badge variant="secondary">
                  {existingCount} existing
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive">{errorCount} errors</Badge>
              )}
              {localResolvedCount > 0 && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {localResolvedCount} local geo
                </Badge>
              )}
              {aiResolvedCount > 0 && (
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  {aiResolvedCount} AI geo
                </Badge>
              )}
              {unresolvedCount > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  {unresolvedCount} no coordinates
                </Badge>
              )}
            </div>
          )}

          {/* AI resolve button */}
          {parsedRows.length > 0 && unresolvedCount > 0 && !aiResolving && (
            <Button variant="outline" size="sm" onClick={handleAiResolve} disabled={busy}>
              <Sparkles className="h-4 w-4 mr-2" />
              Resolve {unresolvedCount} locations with AI
            </Button>
          )}

          {/* AI resolving progress */}
          {aiResolving && (
            <div className="space-y-2">
              <Progress value={aiProgress.total > 0 ? Math.round((aiProgress.current / aiProgress.total) * 100) : 0} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Resolving locations with AI... {aiProgress.current}/{aiProgress.total}
              </p>
            </div>
          )}

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <ScrollArea className="flex-1 min-h-0 max-h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="w-16">Geo</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow
                      key={row.rowNumber}
                      className={
                        row.errors.length > 0
                          ? 'bg-destructive/5'
                          : row.isExisting
                          ? 'opacity-50'
                          : ''
                      }
                    >
                      <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.raw.job_id || '-'}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {row.raw.job_title || <span className="text-muted-foreground italic">empty</span>}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.raw.company_name || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {row.raw.city || row.raw.state
                          ? `${row.raw.city}${row.raw.city && row.raw.state ? ', ' : ''}${row.raw.state}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {row.resolutionMethod === 'ai' ? (
                          <Sparkles className="h-4 w-4 text-purple-600" />
                        ) : row.resolutionMethod === 'local' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : row.raw.city ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{row.raw.end_date || '-'}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <div className="flex items-center gap-1 text-destructive text-xs">
                            <XCircle className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[150px]">{row.errors[0]}</span>
                          </div>
                        ) : row.isExisting ? (
                          <div className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Ban className="h-3 w-3 shrink-0" />
                            <span>Exists</span>
                          </div>
                        ) : (
                          <span className="text-green-600 text-xs">New</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Import progress bar */}
          {importing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Importing... {progress}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={busy || newCount === 0}>
            {importing ? 'Importing...' : `Import ${newCount} New Jobs`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
