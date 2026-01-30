import { useState } from 'react';
import { useHandovers, useHandoverCounts, searchHandoverByToken, type HandoverTab } from '@/hooks/useHandovers';
import { HandoverDetailModal } from '@/components/HandoverDetailModal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorFallback } from '@/components/ErrorFallback';
import { getStatusConfig } from '@/lib/statusConfig';
import { formatDistanceToNow } from 'date-fns';
import type { HandoverWithDetails } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Loader2, Copy, Eye, FileCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function HandoversPage() {
  const [activeTab, setActiveTab] = useState<HandoverTab>('pending');
  const [tokenInput, setTokenInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState<HandoverWithDetails | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: handovers, isLoading, isError, refetch } = useHandovers(activeTab);
  const { data: counts, refetch: refetchCounts } = useHandoverCounts();

  const handleModalUpdate = () => {
    refetch();
    refetchCounts();
  };

  const handleTokenSearch = async () => {
    const token = tokenInput.trim().toUpperCase();
    if (!token) {
      toast({
        title: 'Token required',
        description: 'Please enter an eligibility token.',
        variant: 'destructive',
      });
      return;
    }

    setSearching(true);
    try {
      const result = await searchHandoverByToken(token);
      if (result) {
        setSelectedHandover(result);
        setModalOpen(true);
        setTokenInput('');
      } else {
        toast({
          title: 'Token not found',
          description: `No handover found with token "${token}".`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Search failed',
        description: 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTokenSearch();
    }
  };

  const copyToken = (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(token);
    toast({ title: 'Copied!', description: 'Token copied to clipboard.' });
  };

  const viewHandover = (handover: HandoverWithDetails) => {
    setSelectedHandover(handover);
    setModalOpen(true);
  };

  const tabs: { value: HandoverTab; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'verified', label: 'Verified' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Handovers</h1>
        <p className="text-muted-foreground mt-1">Verify candidates and manage the hiring pipeline.</p>
      </div>

      {/* Token Verification Section */}
      <Card className="shadow-sm border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Verify Token
          </CardTitle>
          <CardDescription>
            Enter the 8-character eligibility token to verify a candidate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter 8-character token (e.g., ABC12345)"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              maxLength={8}
              className="font-mono text-lg tracking-wider uppercase max-w-xs"
            />
            <Button onClick={handleTokenSearch} disabled={searching} size="lg">
              {searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Verify
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HandoverTab)}>
        <TabsList className="grid w-full grid-cols-5">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
              {tab.label}
              {counts && counts[tab.value] > 0 && (
                <Badge
                  variant={tab.value === 'pending' ? 'destructive' : 'secondary'}
                  className="h-5 min-w-[20px] px-1.5"
                >
                  {counts[tab.value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            <Card className="shadow-sm">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : isError ? (
                  <div className="p-6">
                    <ErrorFallback
                      title="Failed to load handovers"
                      message="We couldn't load the handovers. Please try again."
                      onRetry={() => refetch()}
                    />
                  </div>
                ) : !handovers?.length ? (
                  <EmptyState
                    type="handovers"
                    title="No handovers pending"
                    description={activeTab === 'all' ? 'No handovers have been created yet.' : `No handovers in "${activeTab}" status.`}
                  />
                ) : (
                  <div className="table-responsive">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Job Title</TableHead>
                          <TableHead>Token</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {handovers.map((handover) => {
                        const statusConfig = getStatusConfig(handover.status);
                        return (
                          <TableRow
                            key={handover.id}
                            className="cursor-pointer"
                            onClick={() => viewHandover(handover)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {handover.user?.full_name || 'Unknown'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {handover.user?.phone_number}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{handover.job?.job_title || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {handover.job?.position?.replace('_', ' ')}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                                  {handover.eligibility_token}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => copyToken(handover.eligibility_token, e)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig.className}>
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDistanceToNow(new Date(handover.created_at), {
                                addSuffix: true,
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  viewHandover(handover);
                                }}
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail Modal */}
      <HandoverDetailModal
        handover={selectedHandover}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdate={handleModalUpdate}
      />
    </div>
  );
}
