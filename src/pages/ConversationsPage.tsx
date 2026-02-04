import { useState } from 'react';
import {
  useConversations,
  useConversationStats,
  exportConversationsToCSV,
  fetchAllConversationsForExport,
  type ConversationFilters,
} from '@/hooks/useConversations';
import { useDebounce } from '@/hooks/useDebounce';
import type { Conversation } from '@/types/database';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import {
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarIcon,
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  Hash,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const PAGE_SIZE = 50;

export default function ConversationsPage() {
  const [phoneSearch, setPhoneSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const debouncedPhoneSearch = useDebounce(phoneSearch, 300);

  const filters: ConversationFilters = {
    phoneSearch: debouncedPhoneSearch,
    dateFrom,
    dateTo,
    direction,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data: result, isLoading } = useConversations(filters);
  const { data: stats } = useConversationStats();

  const conversations = result?.data || [];
  const totalCount = result?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleExport = async () => {
    setExporting(true);
    try {
      const allData = await fetchAllConversationsForExport({
        phoneSearch: debouncedPhoneSearch,
        dateFrom,
        dateTo,
        direction,
      });
      exportConversationsToCSV(allData);
      toast({ title: 'Success', description: `Exported ${allData.length} conversations.` });
    } catch (error) {
      toast({ title: 'Export failed', description: 'Could not export conversations.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const truncate = (str: string | null, len: number) => {
    if (!str) return '-';
    return str.length > len ? str.slice(0, len) + '...' : str;
  };

  const getMessageTypeBadge = (type: Conversation['message_type']) => {
    const variants: Record<string, string> = {
      text: 'bg-blue-100 text-blue-800',
      location: 'bg-green-100 text-green-800',
      image: 'bg-purple-100 text-purple-800',
      button: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge variant="outline" className={cn('capitalize', variants[type])}>
        {type}
      </Badge>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conversations</h1>
          <p className="text-muted-foreground mt-1">Monitor and debug WhatsApp messages.</p>
        </div>
        <Button onClick={handleExport} disabled={exporting} variant="outline">
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Messages Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMessagesToday ?? '-'}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgProcessingTime ? `${Math.round(stats.avgProcessingTime)}ms` : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Phone Search */}
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="Search by phone..."
                value={phoneSearch}
                onChange={(e) => {
                  setPhoneSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => {
                      setDateFrom(d);
                      setPage(0);
                    }}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => {
                      setDateTo(d);
                      setPage(0);
                    }}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Direction Filter */}
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => {
                  setDirection(v as 'all' | 'inbound' | 'outbound');
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clear filters */}
          {(phoneSearch || dateFrom || dateTo || direction !== 'all') && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPhoneSearch('');
                  setDateFrom(undefined);
                  setDateTo(undefined);
                  setDirection('all');
                  setPage(0);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            {totalCount.toLocaleString()} messages
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
              <p>No conversations found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conv) => (
                  <Collapsible key={conv.id} asChild open={expandedRow === conv.id}>
                    <>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleRow(conv.id)}
                      >
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {expandedRow === conv.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(conv.created_at), 'MMM d, HH:mm:ss')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{conv.phone_number}</TableCell>
                        <TableCell>
                          {conv.direction === 'inbound' ? (
                            <div className="flex items-center gap-1.5 text-blue-600">
                              <ArrowDownLeft className="h-4 w-4" />
                              <span className="text-sm">In</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-green-600">
                              <ArrowUpRight className="h-4 w-4" />
                              <span className="text-sm">Out</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-sm">{truncate(conv.message_content, 50)}</span>
                        </TableCell>
                        <TableCell>{getMessageTypeBadge(conv.message_type)}</TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={6} className="p-4">
                            <div className="space-y-4">
                              {/* Full Message */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Full Message</Label>
                                <p className="mt-1 text-sm whitespace-pre-wrap bg-background p-3 rounded-md border">
                                  {conv.message_content || 'No content'}
                                </p>
                              </div>

                              {/* Processing Time */}
                              <div className="flex gap-8">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Processing Time</Label>
                                  <p className="mt-1 text-sm font-medium">
                                    {conv.processing_time_ms ? `${conv.processing_time_ms}ms` : 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">WA Message ID</Label>
                                  <p className="mt-1 text-sm font-mono">{conv.wa_message_id || 'N/A'}</p>
                                </div>
                              </div>

                              {/* Raw Payload */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Raw Payload</Label>
                                <pre className="mt-1 text-xs bg-background p-3 rounded-md border overflow-x-auto max-h-48">
                                  {JSON.stringify(conv.raw_payload, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className={cn(page === 0 && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (page < 3) {
                  pageNum = i;
                } else if (page > totalPages - 4) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setPage(pageNum)}
                      isActive={page === pageNum}
                    >
                      {pageNum + 1}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className={cn(page === totalPages - 1 && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
