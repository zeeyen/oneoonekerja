import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApplicants, useTotalApplicantsCount, type ApplicantFilter } from '@/hooks/useApplicants';
import { getApplicantStatusConfig, isApplicantBanned } from '@/lib/applicantStatusConfig';
import { EmptyState } from '@/components/EmptyState';
import { ErrorFallback } from '@/components/ErrorFallback';
import { BanDetailsDialog } from '@/components/BanDetailsDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Search, Users as UsersIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDebounce } from '@/hooks/useDebounce';
import type { Applicant } from '@/types/database';

const PAGE_SIZE = 20;

const filterOptions: { value: ApplicantFilter; label: string }[] = [
  { value: 'all', label: 'All Applicants' },
  { value: 'active', label: 'Active Only' },
  { value: 'completed', label: 'Completed Onboarding' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'new', label: 'New' },
];

export default function ApplicantsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState<ApplicantFilter>('all');
  const [page, setPage] = useState(1);
  const [banDialogApplicant, setBanDialogApplicant] = useState<Applicant | null>(null);

  const debouncedSearch = useDebounce(searchInput, 300);

  const { data: totalCount } = useTotalApplicantsCount();
  const { data, isLoading, isError, refetch } = useApplicants({
    search: debouncedSearch,
    filter,
    page,
    pageSize: PAGE_SIZE,
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

      {/* Search and Filters */}
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
            <Select value={filter} onValueChange={(value) => setFilter(value as ApplicantFilter)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter applicants" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.applicants.map((applicant) => {
                        const statusConfig = getApplicantStatusConfig(applicant);
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
                            <TableCell className="font-mono text-sm">
                              {applicant.phone_number}
                            </TableCell>
                            <TableCell>
                              {formatLocation(applicant.location_city, applicant.location_state)}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig.className}>
                                {statusConfig.label}
                                {isBanned && applicant.violation_count > 0 && (
                                  <span className="ml-1">({applicant.violation_count})</span>
                                )}
                              </Badge>
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
    </div>
  );
}
