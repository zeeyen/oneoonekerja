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
import { Upload, Download, CheckCircle2, AlertTriangle, XCircle, FileText } from 'lucide-react';
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

  const { fetchLocations, locationsLoaded, processRows, importRows, importing, progress } =
    useBulkImportJobs();

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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const { rows, headerError } = parseCsvContent(content);
        if (headerError) {
          setParseError(headerError);
          setParsedRows([]);
          return;
        }
        setParseError(null);
        setParsedRows(processRows(rows));
      };
      reader.readAsText(file);
    },
    [processRows],
  );

  const validCount = parsedRows.filter((r) => r.errors.length === 0).length;
  const errorCount = parsedRows.filter((r) => r.errors.length > 0).length;
  const warningCount = parsedRows.filter((r) => !r.locationResolved && r.errors.length === 0).length;

  const handleImport = useCallback(async () => {
    try {
      const result = await importRows(parsedRows);
      toast({
        title: 'Import complete',
        description: `${result.inserted} jobs imported. ${result.locationWarnings > 0 ? `${result.locationWarnings} without coordinates.` : ''}`,
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

  return (
    <Dialog open={open} onOpenChange={importing ? undefined : onOpenChange}>
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
              disabled={importing || !locationsLoaded}
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
            <div className="flex items-center gap-2">
              <Badge variant="outline">{parsedRows.length} rows</Badge>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {validCount} valid
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive">{errorCount} errors</Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  {warningCount} no coordinates
                </Badge>
              )}
            </div>
          )}

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <ScrollArea className="flex-1 min-h-0 max-h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
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
                      className={row.errors.length > 0 ? 'bg-destructive/5' : ''}
                    >
                      <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
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
                        {row.locationResolved ? (
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
                        ) : (
                          <span className="text-green-600 text-xs">Ready</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Progress bar */}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing || validCount === 0}>
            {importing ? 'Importing...' : `Import ${validCount} Jobs`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
