import { useParams, useNavigate } from 'react-router-dom';
import { useJobDetail, useJobMatches } from '@/hooks/useJobDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ArrowLeft,
  MapPin,
  DollarSign,
  Calendar,
  Users,
  ExternalLink,
  Briefcase,
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';

const genderLabels: Record<string, string> = {
  any: 'Any',
  male: 'Male only',
  female: 'Female only',
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: job, isLoading: jobLoading } = useJobDetail(id);
  const { data: matches, isLoading: matchesLoading } = useJobMatches(id);

  if (jobLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => navigate('/jobs')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Job not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = isPast(parseISO(job.expire_by));

  const formatAgeRange = () => {
    if (job.min_age && job.max_age) {
      return `${job.min_age} - ${job.max_age} years`;
    } else if (job.min_age) {
      return `${job.min_age}+ years`;
    } else if (job.max_age) {
      return `Up to ${job.max_age} years`;
    }
    return 'Any age';
  };

  const formatExperience = () => {
    if (job.min_experience_years === 0) {
      return '0 years (No experience required)';
    }
    return `${job.min_experience_years}+ years`;
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/jobs')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Jobs
      </Button>

      {/* Header section */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
              {job.company && (
                <p className="text-lg text-muted-foreground mt-1">{job.company}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={
                  isExpired
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : 'bg-green-100 text-green-800 border-green-200'
                }
              >
                {isExpired ? 'Expired' : 'Active'}
              </Badge>
              {job.industry && (
                <Badge variant="outline">{job.industry}</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details card - two columns */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Salary Range
                </label>
                <p className="mt-1 font-medium">{job.salary_range || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </label>
                <p className="mt-1">
                  {[job.location_city, job.location_state].filter(Boolean).join(', ') ||
                    'Not specified'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Industry
                </label>
                <p className="mt-1">{job.industry || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Min Experience
                </label>
                <p className="mt-1">{formatExperience()}</p>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Gender Requirement
                </label>
                <p className="mt-1">{genderLabels[job.gender_requirement] || 'Any'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Age Range</label>
                <p className="mt-1">{formatAgeRange()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Expires On
                </label>
                <p className={`mt-1 ${isExpired ? 'text-destructive' : ''}`}>
                  {format(parseISO(job.expire_by), 'dd MMMM yyyy')}
                </p>
              </div>
              {job.url && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Job URL
                  </label>
                  <p className="mt-1">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {job.url}
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Matches section */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Job Matches</CardTitle>
        </CardHeader>
        <CardContent>
          {matchesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : matches && matches.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Match Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell>
                        <button
                          onClick={() => navigate(`/applicants/${match.user_id}`)}
                          className="text-primary hover:underline font-medium text-left"
                        >
                          {match.applicant?.full_name || 'Unknown'}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {match.applicant?.phone_number || '-'}
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
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No applicants matched to this job yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
