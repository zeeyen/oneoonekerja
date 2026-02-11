import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackfillGeocode, useUnresolvedJobsCount } from '@/hooks/useBackfillGeocode';
import {
  useJobs,
  useActiveJobsCount,
  MALAYSIAN_STATES,
  INDUSTRY_OPTIONS,
  type JobStatusFilter,
} from '@/hooks/useJobs';
import { EmptyState } from '@/components/EmptyState';
import { ErrorFallback } from '@/components/ErrorFallback';
import { TooltipHeader } from '@/components/TooltipHeader';
import { BulkImportJobsModal } from '@/components/BulkImportJobsModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Search, Briefcase, ExternalLink, Upload, MapPin } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { useDebounce } from '@/hooks/useDebounce';

const PAGE_SIZE = 20;

const statusFilterOptions: { value: JobStatusFilter; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
];

export default function JobsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const { data: unresolvedCount } = useUnresolvedJobsCount();
  const { run: runBackfill, isRunning: isBackfilling, progress: backfillProgress } = useBackfillGeocode();

  const debouncedSearch = useDebounce(searchInput, 300);

  const { data: activeCount } = useActiveJobsCount();
  const { data, isLoading, isError, refetch } = useJobs({
    search: debouncedSearch,
    statusFilter,
    industryFilter,
    stateFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  // Reset to page 1 when filters change
  useMemo(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, industryFilter, stateFilter]);

  const formatLocation = (city: string | null, state: string | null) => {
    if (city && state) return `${city}, ${state}`;
    return city || state || '-';
  };

  const isJobExpired = (expireBy: string) => {
    return isPast(parseISO(expireBy));
  };

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
              className={
                page === data.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
            <p className="text-sm text-muted-foreground">
              {activeCount !== undefined
                ? `${activeCount.toLocaleString()} active jobs`
                : 'Loading...'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {unresolvedCount !== undefined && unresolvedCount > 0 && (
            <Button
              variant="outline"
              onClick={runBackfill}
              disabled={isBackfilling}
            >
              <MapPin className="h-4 w-4 mr-2" />
              {isBackfilling && backfillProgress
                ? `Resolving... ${backfillProgress.current}/${backfillProgress.total}`
                : `Backfill Coordinates (${unresolvedCount})`}
            </Button>
          )}
          <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
        </div>
      </div>

      {isBackfilling && backfillProgress && (
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Resolving coordinates... {backfillProgress.current}/{backfillProgress.total}
                {backfillProgress.resolved > 0 && ` (${backfillProgress.resolved} resolved)`}
              </p>
              <Progress value={(backfillProgress.current / backfillProgress.total) * 100} />
            </div>
          </CardContent>
        </Card>
      )}

      <BulkImportJobsModal open={bulkImportOpen} onOpenChange={setBulkImportOpen} />

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Job ID, title or company..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as JobStatusFilter)}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {statusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={industryFilter}
                onValueChange={setIndustryFilter}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All Industries</SelectItem>
                  {INDUSTRY_OPTIONS.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Location State" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                  <SelectItem value="all">All States</SelectItem>
                  {MALAYSIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              title="Failed to load jobs"
              message="We couldn't load the job list. Please try again."
              onRetry={() => refetch()}
            />
          ) : data && data.jobs.length > 0 ? (
            <>
              <div className="table-responsive">
                <div className="rounded-md border min-w-[700px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>
                          <TooltipHeader 
                            label="Location" 
                            tooltip="Job location used for distance-based matching with applicants" 
                          />
                        </TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>
                          <TooltipHeader 
                            label="Salary" 
                            tooltip="Displayed to applicants during job matching" 
                          />
                        </TableHead>
                        <TableHead>
                          <TooltipHeader 
                            label="Expires" 
                            tooltip="Job automatically hidden from search results after this date" 
                          />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.jobs.map((job) => {
                        const expired = isJobExpired(job.expire_by);
                        return (
                          <TableRow
                            key={job.id}
                            className={`cursor-pointer hover:bg-muted/50 ${
                              expired ? 'bg-muted/30' : ''
                            }`}
                            onClick={() => navigate(`/jobs/${job.id}`)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {job.title}
                                {expired && (
                                  <Badge variant="secondary" className="text-xs">
                                    Expired
                                  </Badge>
                                )}
                                {job.url && (
                                  <a
                                    href={job.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted-foreground hover:text-primary"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{job.company || '-'}</TableCell>
                            <TableCell>
                              {formatLocation(job.location_city, job.location_state)}
                            </TableCell>
                            <TableCell>
                              {job.industry ? (
                                <Badge variant="outline">{job.industry}</Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {job.salary_range || '-'}
                            </TableCell>
                            <TableCell
                              className={`text-sm ${
                                expired ? 'text-destructive' : 'text-muted-foreground'
                              }`}
                            >
                              {format(parseISO(job.expire_by), 'dd MMM yyyy')}
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
                  Showing {(page - 1) * PAGE_SIZE + 1} to{' '}
                  {Math.min(page * PAGE_SIZE, data.totalCount)} of {data.totalCount} jobs
                </p>
                {renderPagination()}
              </div>
            </>
          ) : (
            <EmptyState
              type="jobs"
              title="No jobs found"
              description={
                searchInput || statusFilter !== 'all' || industryFilter !== 'all' || stateFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'No jobs have been added yet.'
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
