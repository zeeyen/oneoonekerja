import { useState, useMemo, useCallback } from 'react';
import { PhoneLink } from '@/components/PhoneLink';
import { useNavigate } from 'react-router-dom';
import { useApplicants, useTotalApplicantsCount, fetchAllFilteredApplicants, type ApplicantFilter } from '@/hooks/useApplicants';
import { getApplicantStatusConfig, isApplicantBanned } from '@/lib/applicantStatusConfig';
import { maskIcNumber } from '@/lib/maskSensitiveData';
import { useAdmin } from '@/contexts/AdminContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorFallback } from '@/components/ErrorFallback';
import { BanDetailsDialog } from '@/components/BanDetailsDialog';
import { TooltipHeader } from '@/components/TooltipHeader';
import { ApplicantFunnel } from '@/components/ApplicantFunnel';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, Users as UsersIcon, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';
import type { Applicant } from '@/types/database';
import { type TimeFilter, getSinceDate } from '@/hooks/useJobStats';

const PAGE_SIZE = 20;

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function ApplicantsPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState<ApplicantFilter>('all');
  const [page, setPage] = useState(1);
  const [banDialogApplicant, setBanDialogApplicant] = useState<Applicant | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const debouncedSearch = useDebounce(searchInput, 300);
  const since = getSinceDate(timeFilter);

  const { data: totalCount } = useTotalApplicantsCount();
  const { data, isLoading, isError, refetch } = useApplicants({
    search: debouncedSearch,
    filter,
    page,
    pageSize: PAGE_SIZE,
    since,
  });

  // Reset to page 1 when search or filter changes
  useMemo(() => {
    setPage(1);
  }, [debouncedSearch, filter]);

  const formatLocation = (city: string | null, state: string | null) => {
    if (city && state) return `${city}, ${state}`;
    return city || state || '-';
  };

  const formatLastActive = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return '-';
    }
  };

  const getViolationBadge = (count: number) => {
    if (count === 0) return null;
    const isHighRisk = count >= 3;
    return (
      <Badge 
        variant="outline" 
        className={`ml-2 text-xs ${
          isHighRisk 
            ? 'border-destructive text-destructive bg-destructive/10' 
            : 'border-amber-500 text-amber-600 bg-amber-50'
        }`}
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        {count} violation{count > 1 ? 's' : ''}
      </Badge>
    );
  };

  const renderStatusCell = (applicant: Applicant) => {
    const statusConfig = getApplicantStatusConfig(applicant);
    const isBanned = isApplicantBanned(applicant);
    
    if (isBanned) {
      const banDate = applicant.banned_until 
        ? format(new Date(applicant.banned_until), 'dd MMM yyyy, HH:mm')
        : 'Unknown';
      const reason = applicant.ban_reason || 'No reason provided';
      
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-destructive text-destructive-foreground cursor-help">
              BANNED
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[300px]">
            <p className="text-xs font-medium">Banned until {banDate}</p>
            <p className="text-xs text-muted-foreground mt-1">Reason: {reason}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return (
      <div className="flex items-center">
        <Badge className={statusConfig.className}>
          {statusConfig.label}
        </Badge>
        {getViolationBadge(applicant.violation_count)}
      </div>
    );
  };

  const handleExportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const applicants = await fetchAllFilteredApplicants(debouncedSearch, filter, since);
      
      const headers = ['Name', 'Phone', 'IC Number', 'City', 'State', 'Status', 'Violations', 'Last Active', 'Created'];
      const rows = applicants.map((a) => [
        escapeCsvField(a.full_name || 'Unknown'),
        escapeCsvField(a.phone_number),
        escapeCsvField(maskIcNumber(a.ic_number, isAdmin)),
        escapeCsvField(a.location_city || ''),
        escapeCsvField(a.location_state || ''),
        escapeCsvField(isApplicantBanned(a) ? 'Banned' : (a.onboarding_status || 'new')),
        String(a.violation_count),
        a.last_active_at ? format(new Date(a.last_active_at), 'yyyy-MM-dd HH:mm') : '',
        a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd HH:mm') : '',
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `applicants-${filter}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${applicants.length} applicants to CSV`);
    } catch (err) {
      console.error('CSV export error:', err);
      toast.error('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  }, [debouncedSearch, filter, isAdmin, since]);

  const renderPagination = () => {
    if (!data || data.totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(data.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          {pages.map((p) => (
            <PaginationItem key={p}>
              <PaginationLink
                onClick={() => setPage(p)}
                isActive={page === p}
                className="cursor-pointer"
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              className={page === data.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <UsersIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Applicants</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount !== undefined ? `${totalCount.toLocaleString()} total applicants` : 'Loading...'}
            </p>
          </div>
        </div>
      </div>

      {/* Funnel Widget */}
      <ApplicantFunnel activeFilter={filter} onFilterChange={setFilter} since={since} />

      {/* Time Filter */}
      <div className="flex items-center gap-2">
        {([
          { value: '24h', label: 'Last 24h' },
          { value: '7d', label: '7 days' },
          { value: '1m', label: '1 month' },
          { value: 'all', label: 'All time' },
        ] as const).map((opt) => (
          <Button
            key={opt.value}
            variant={timeFilter === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Search and CSV Export */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or IC number..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="shrink-0"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorFallback
              title="Failed to load applicants"
              message="We couldn't load the applicant list. Please try again."
              onRetry={() => refetch()}
            />
          ) : data && data.applicants.length > 0 ? (
            <>
              <div className="table-responsive">
                <div className="rounded-md border min-w-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>
                          <TooltipHeader 
                            label="Location" 
                            tooltip="City and state extracted from user's WhatsApp message, used for job proximity matching" 
                          />
                        </TableHead>
                        <TableHead>
                          <TooltipHeader 
                            label="Status" 
                            tooltip="Current state in bot flow: 'new' = just started, 'in_progress' = collecting info, 'matching' = viewing jobs, 'completed' = selected a job" 
                          />
                        </TableHead>
                        <TableHead>
                          <TooltipHeader 
                            label="Last Active" 
                            tooltip="Timestamp of user's most recent WhatsApp message to Kak Ani" 
                          />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.applicants.map((applicant) => {
                        const isBanned = isApplicantBanned(applicant);
                        return (
                          <TableRow
                            key={applicant.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              if (isBanned) {
                                setBanDialogApplicant(applicant);
                              } else {
                                navigate(`/applicants/${applicant.id}`);
                              }
                            }}
                          >
                            <TableCell className="font-medium">
                              {applicant.full_name || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              <PhoneLink phoneNumber={applicant.phone_number} />
                            </TableCell>
                            <TableCell>
                              {formatLocation(applicant.location_city, applicant.location_state)}
                            </TableCell>
                            <TableCell>
                              {renderStatusCell(applicant)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatLastActive(applicant.last_active_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination info and controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * PAGE_SIZE) + 1} to{' '}
                  {Math.min(page * PAGE_SIZE, data.totalCount)} of {data.totalCount} applicants
                </p>
                {renderPagination()}
              </div>
            </>
          ) : (
            <EmptyState
              type="applicants"
              title="No applicants found"
              description={
                searchInput || filter !== 'all'
                  ? 'Try adjusting your search or filter.'
                  : 'Applicants will appear here once they register via WhatsApp.'
              }
            />
          )}
        </CardContent>
      </Card>

      <BanDetailsDialog
        applicant={banDialogApplicant}
        open={banDialogApplicant !== null}
        onOpenChange={(open) => !open && setBanDialogApplicant(null)}
      />
    </div>
  );
}
