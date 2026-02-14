import { useParams, useNavigate } from 'react-router-dom';
import { PhoneLink } from '@/components/PhoneLink';
import {
  useApplicantDetail,
  useApplicantJobSelections,
  useApplicantConversations,
} from '@/hooks/useApplicantDetail';
import { useAdminActions } from '@/hooks/useModeration';
import { getOnboardingStatusConfig } from '@/lib/applicantStatusConfig';
import { ModerationSection } from '@/components/ModerationSection';
import { ModerationHistory } from '@/components/ModerationHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Car,
  Accessibility,
  Briefcase,
  Clock,
  MessageSquare,
  CheckCircle,
  XCircle,
  ExternalLink,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAdmin } from '@/contexts/AdminContext';
import { maskIcNumber } from '@/lib/maskSensitiveData';

const languageLabels: Record<string, string> = {
  ms: 'Bahasa Malaysia',
  en: 'English',
  zh: '中文',
};

const jobTypeLabels: Record<string, string> = {
  part_time: 'Part-time',
  full_time: 'Full-time',
};

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  const { data: applicant, isLoading: applicantLoading } = useApplicantDetail(id!);
  const { data: jobSelections, isLoading: selectionsLoading } = useApplicantJobSelections(id!);
  const { data: conversations, isLoading: conversationsLoading } = useApplicantConversations(
    id!,
    applicant?.phone_number
  );
  const { data: adminActions = [], isLoading: actionsLoading } = useAdminActions(id!);

  if (applicantLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => navigate('/applicants')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Applicants
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Applicant not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = getOnboardingStatusConfig(applicant.onboarding_status);

  const formatAvailability = (availability: Record<string, boolean> | null) => {
    if (!availability) return ['Not specified'];
    const slots = Object.entries(availability)
      .filter(([, available]) => available)
      .map(([slot]) => slot.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    return slots.length > 0 ? slots : ['Not specified'];
  };

  const handleDownloadConversation = () => {
    if (!conversations || conversations.length === 0) return;
    const escapeCsv = (val: string) => {
      if (/[",\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
      return val;
    };
    const header = 'Date,Time,Direction,Type,Content';
    const rows = conversations.map((msg) => {
      const d = new Date(msg.created_at);
      return [
        format(d, 'yyyy-MM-dd'),
        format(d, 'HH:mm:ss'),
        msg.direction,
        msg.message_type || 'text',
        escapeCsv(msg.message_content || `[${msg.message_type}]`),
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = (applicant.full_name || 'unknown').replace(/\s+/g, '_');
    a.href = url;
    a.download = `conversation_${name}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/applicants')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Applicants
      </Button>

      {/* Header section */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {applicant.full_name || 'Unknown Applicant'}
              </h1>
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <PhoneLink phoneNumber={applicant.phone_number} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
              {applicant.is_active ? (
                <Badge className="bg-success/10 text-success border-success/20">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground border-muted">
                  <XCircle className="mr-1 h-3 w-3" />
                  Inactive
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile card - two columns */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">IC Number</label>
                <p className="mt-1 font-mono">{maskIcNumber(applicant.ic_number, isAdmin)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Age</label>
                <p className="mt-1">{applicant.age ? `${applicant.age} years old` : '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Gender</label>
                <p className="mt-1 capitalize">{applicant.gender || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Preferred Language</label>
                <p className="mt-1">{languageLabels[applicant.preferred_language] || applicant.preferred_language}</p>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </label>
                <p className="mt-1">
                  {[applicant.location_city, applicant.location_state, applicant.location_postcode]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Transport
                </label>
                <p className="mt-1">
                  {applicant.has_transport
                    ? `Yes${applicant.transport_type ? ` (${applicant.transport_type})` : ''}`
                    : 'No'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Accessibility className="h-4 w-4" />
                  OKU Status
                </label>
                <p className="mt-1">{applicant.is_oku ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Years Experience
                </label>
                <p className="mt-1">{applicant.years_experience ?? 0} years</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences section */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Job Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Job Types</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(applicant.preferred_job_types ?? []).length > 0 ? (
                (applicant.preferred_job_types ?? []).map((type) => (
                  <Badge key={type} variant="secondary">
                    {jobTypeLabels[type] || type}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">Not specified</span>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Preferred Positions</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(applicant.preferred_positions ?? []).length > 0 ? (
                (applicant.preferred_positions ?? []).map((position) => (
                  <Badge key={position} variant="outline" className="capitalize">
                    {position}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">Not specified</span>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Availability
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {formatAvailability(applicant.availability).map((slot) => (
                <Badge key={slot} variant="outline" className="bg-info/10">
                  {slot}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Moderation */}
      <ModerationSection applicant={applicant} />
      <ModerationHistory actions={adminActions} isLoading={actionsLoading} />

      {/* Tabs */}
      <Tabs defaultValue="selections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="selections">Job Selections</TabsTrigger>
          <TabsTrigger value="conversations">Conversation History</TabsTrigger>
        </TabsList>

        {/* Job Selections Tab */}
        <TabsContent value="selections">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {selectionsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : jobSelections && jobSelections.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Apply Link</TableHead>
                        <TableHead>Selected At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobSelections.map((sel) => (
                        <TableRow key={sel.id}>
                          <TableCell className="font-medium">
                            {sel.job_title}
                          </TableCell>
                          <TableCell>
                            {sel.company || '-'}
                          </TableCell>
                          <TableCell>
                            {[sel.location_city, sel.location_state].filter(Boolean).join(', ') || '-'}
                          </TableCell>
                          <TableCell>
                            {sel.apply_url ? (
                              <a
                                href={sel.apply_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                              >
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {sel.selected_at ? format(new Date(sel.selected_at), 'dd MMM yyyy, HH:mm') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No job selections yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {conversations && conversations.length > 0 && (
                <div className="flex justify-end mb-4">
                  <Button variant="outline" size="sm" onClick={handleDownloadConversation}>
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </Button>
                </div>
              )}
              {conversationsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-3/4" />
                  ))}
                </div>
              ) : conversations && conversations.length > 0 ? (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {conversations.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-4 py-2 ${
                            msg.direction === 'outbound'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.message_content || (
                              <span className="italic opacity-70">
                                [{msg.message_type}]
                              </span>
                            )}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              msg.direction === 'outbound'
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {format(new Date(msg.created_at), 'dd MMM yyyy, HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No conversation history</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
