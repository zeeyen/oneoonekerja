import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useJobs,
  useActiveJobsCount,
  useUpdateJobStatus,
  MALAYSIAN_STATES,
  type JobStatusFilter,
  type JobTypeFilter,
} from '@/hooks/useJobs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { Search, Briefcase, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/hooks/use-toast';

const PAGE_SIZE = 20;

const statusFilterOptions: { value: JobStatusFilter; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const typeFilterOptions: { value: JobTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'full_time', label: 'Full-time' },
];

export default function JobsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<JobTypeFilter>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchInput, 300);

  const { data: activeCount } = useActiveJobsCount();
  const { data, isLoading } = useJobs({
    search: debouncedSearch,
    statusFilter,
    typeFilter,
    stateFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const updateStatusMutation = useUpdateJobStatus();

  // Reset to page 1 when filters change
  useMemo(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, typeFilter, stateFilter]);

  const formatLocation = (city: string | null, state: string | null) => {
    if (city && state) return `${city}, ${state}`;
    return city || state || '-';
  };

  const getJobTypeLabel = (jobType: number | null) => {
    if (jobType === 1) return 'Part-time';
    if (jobType === 2) return 'Full-time';
    return '-';
  };

  const getJobTypeBadgeClass = (jobType: number | null) => {
    if (jobType === 1) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (jobType === 2) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-800';
  };

  const handleStatusToggle = async (
    e: React.MouseEvent,
    jobId: string,
    currentStatus: boolean
  ) => {
    e.stopPropagation(); // Prevent row click

    try {
      await updateStatusMutation.mutateAsync({
        jobId,
        isActive: !currentStatus,
      });
      toast({
        title: 'Status updated',
        description: `Job is now ${!currentStatus ? 'active' : 'inactive'}.`,
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Failed to update job status. Please try again.',
        variant: 'destructive',
      });
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
        <Button onClick={() => navigate('/jobs/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Job
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job title or position..."
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
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as JobTypeFilter)}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Job Type" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {typeFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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

      {/* Data Table */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data && data.jobs.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Slots</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.jobs.map((job) => (
                      <TableRow
                        key={job.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <TableCell className="font-medium">{job.job_title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {job.position}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatLocation(job.location_city, job.location_state)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getJobTypeBadgeClass(job.job_type)}>
                            {getJobTypeLabel(job.job_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {job.slots_available}
                        </TableCell>
                        <TableCell className="text-center">
                          <div
                            className="flex justify-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Switch
                              checked={job.is_active}
                              onCheckedChange={() => {}}
                              onClick={(e) => handleStatusToggle(e, job.id, job.is_active)}
                              disabled={updateStatusMutation.isPending}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {job.end_date ? format(new Date(job.end_date), 'dd MMM yyyy') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No jobs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchInput || statusFilter !== 'all' || typeFilter !== 'all' || stateFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Click "Add Job" to create your first job listing.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
