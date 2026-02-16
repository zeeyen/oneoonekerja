import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useJobDetail, useJobMatches } from '@/hooks/useJobDetail';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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
  Pencil,
  Hash,
  Tag,
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { JobEditForm, type JobEditFormData } from '@/components/JobEditForm';
import { PhoneLink } from '@/components/PhoneLink';

const genderLabels: Record<string, string> = {
  any: 'Any',
  male: 'Male only',
  female: 'Female only',
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: job, isLoading: jobLoading } = useJobDetail(id);
  const { data: matches, isLoading: matchesLoading } = useJobMatches(id);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Handle navigation blocking when editing
  const handleBeforeNavigate = useCallback(
    (e: PopStateEvent) => {
      if (isEditing) {
        const confirmLeave = window.confirm(
          'You have unsaved changes. Are you sure you want to leave?'
        );
        if (!confirmLeave) {
          e.preventDefault();
          window.history.pushState(null, '', window.location.href);
        }
      }
    },
    [isEditing]
  );

  useEffect(() => {
    if (isEditing) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handleBeforeNavigate);
      return () => window.removeEventListener('popstate', handleBeforeNavigate);
    }
  }, [isEditing, handleBeforeNavigate]);

  const handleSave = async (formData: JobEditFormData) => {
    if (!id || !user?.email) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          title: formData.title,
          company: formData.company,
          location_city: formData.location_city || null,
          location_state: formData.location_state || null,
          industry: formData.industry || null,
          salary_range: formData.salary_range || null,
          gender_requirement: formData.gender_requirement,
          min_age: formData.min_age,
          max_age: formData.max_age,
          min_experience_years: formData.min_experience_years,
          expire_by: formData.expire_by,
          url: formData.url || null,
          postcode: formData.postcode || null,
          location_address: formData.location_address || null,
          last_edited_by: user.id,
          last_edited_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Job updated successfully');
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['job-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error) {
      console.error('Error updating job:', error);
      toast.error('Failed to update job. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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
      <Button
        variant="ghost"
        onClick={() => {
          if (isEditing) {
            const confirmLeave = window.confirm(
              'You have unsaved changes. Are you sure you want to leave?'
            );
            if (!confirmLeave) return;
          }
          navigate('/jobs');
        }}
        className="mb-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Jobs
      </Button>

      {/* Header section with Edit button */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
                {job.external_job_id && (
                  <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {job.external_job_id}
                  </span>
                )}
              </div>
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
              {job.industry && <Badge variant="outline">{job.industry}</Badge>}
              {user && !isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Job
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form or Details Card */}
      {isEditing ? (
        <JobEditForm
          job={job}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          isSaving={isSaving}
        />
      ) : (
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
                  {job.postcode && (
                    <p className="text-sm text-muted-foreground">Postcode: {job.postcode}</p>
                  )}
                  {job.location_address && (
                    <p className="text-sm text-muted-foreground">{job.location_address}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Industry
                  </label>
                  <p className="mt-1">{job.industry || 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Job Type
                  </label>
                  <p className="mt-1">{job.job_type || 'Not specified'}</p>
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
      )}

      {/* Last edited info */}
      {job.last_edited_at && job.last_edited_by && (
        <p className="text-sm text-muted-foreground italic">
          Last edited by {job.last_edited_by} on{' '}
          {format(parseISO(job.last_edited_at), "d MMM yyyy 'at' h:mm a")}
        </p>
      )}

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
                      <TableCell>
                        <PhoneLink phoneNumber={match.applicant?.phone_number} />
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
