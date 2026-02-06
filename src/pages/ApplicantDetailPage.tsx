import { useParams, useNavigate } from 'react-router-dom';
import {
  useApplicantDetail,
  useApplicantJobMatches,
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
} from 'lucide-react';
import { format } from 'date-fns';

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
  const navigate = useNavigate();

  const { data: applicant, isLoading: applicantLoading } = useApplicantDetail(id!);
  const { data: jobMatches, isLoading: matchesLoading } = useApplicantJobMatches(id!);
  const { data: conversations, isLoading: conversationsLoading } = useApplicantConversations(
    id!,
    applicant?.phone_number
  );

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

  const formatAvailability = (availability: Record<string, boolean>) => {
    const slots = Object.entries(availability)
      .filter(([, available]) => available)
      .map(([slot]) => slot.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    return slots.length > 0 ? slots : ['Not specified'];
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
                <span className="font-mono">{applicant.phone_number}</span>
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
                <p className="mt-1 font-mono">{applicant.ic_number || '-'}</p>
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
                <p className="mt-1">{applicant.years_experience} years</p>
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
              {applicant.preferred_job_types.length > 0 ? (
                applicant.preferred_job_types.map((type) => (
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
              {applicant.preferred_positions.length > 0 ? (
                applicant.preferred_positions.map((position) => (
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

      {/* Tabs */}
      <Tabs defaultValue="matches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matches">Job Matches</TabsTrigger>
          <TabsTrigger value="conversations">Conversation History</TabsTrigger>
        </TabsList>

        {/* Job Matches Tab */}
        <TabsContent value="matches">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {matchesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : jobMatches && jobMatches.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Match Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobMatches.map((match) => (
                        <TableRow key={match.id}>
                          <TableCell className="font-medium">
                            {match.job?.title || 'Unknown Job'}
                          </TableCell>
                          <TableCell>
                            {match.job?.company || '-'}
                          </TableCell>
                          <TableCell>
                            {match.match_score !== null ? (
                              <span className="font-mono">{match.match_score.toFixed(1)}%</span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                match.status === 'accepted'
                                  ? 'default'
                                  : match.status === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                              className="capitalize"
                            >
                              {match.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(match.created_at), 'dd MMM yyyy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No job matches yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
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
