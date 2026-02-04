import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useJobById,
  useCreateJob,
  useUpdateJob,
  INDUSTRY_OPTIONS,
  defaultJobFormData,
  type JobFormData,
} from '@/hooks/useJobForm';
import { MALAYSIAN_STATES } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ArrowLeft, CalendarIcon, Loader2 } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface JobFormPageProps {
  mode: 'create' | 'edit';
}

export default function JobFormPage({ mode }: JobFormPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = mode === 'edit';

  const { data: existingJob, isLoading: jobLoading } = useJobById(isEditMode ? id : undefined);
  const createJobMutation = useCreateJob();
  const updateJobMutation = useUpdateJob();

  const [formData, setFormData] = useState<JobFormData>(defaultJobFormData);
  const [expireDate, setExpireDate] = useState<Date | undefined>();

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditMode && existingJob) {
      setFormData({
        title: existingJob.title,
        company: existingJob.company || '',
        location_state: existingJob.location_state || '',
        location_city: existingJob.location_city || '',
        min_experience_years: existingJob.min_experience_years || 0,
        salary_range: existingJob.salary_range || '',
        gender_requirement: existingJob.gender_requirement as 'any' | 'male' | 'female',
        industry: existingJob.industry || '',
        url: existingJob.url || '',
        expire_by: existingJob.expire_by,
        min_age: existingJob.min_age,
        max_age: existingJob.max_age,
      });
      if (existingJob.expire_by) setExpireDate(parseISO(existingJob.expire_by));
    }
  }, [isEditMode, existingJob]);

  const handleInputChange = (field: keyof JobFormData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleExpireDateChange = (date: Date | undefined) => {
    setExpireDate(date);
    handleInputChange('expire_by', date ? format(date, 'yyyy-MM-dd') : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      toast({ title: 'Validation Error', description: 'Job title is required.', variant: 'destructive' });
      return;
    }
    if (!formData.expire_by) {
      toast({ title: 'Validation Error', description: 'Expiry date is required.', variant: 'destructive' });
      return;
    }

    try {
      if (isEditMode && id) {
        await updateJobMutation.mutateAsync({ id, formData });
        toast({ title: 'Success', description: 'Job updated successfully.' });
      } else {
        await createJobMutation.mutateAsync(formData);
        toast({ title: 'Success', description: 'Job created successfully.' });
      }
      navigate('/jobs');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save job. Please try again.', variant: 'destructive' });
    }
  };

  const isSubmitting = createJobMutation.isPending || updateJobMutation.isPending;

  if (isEditMode && jobLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (isEditMode && !existingJob && !jobLoading) {
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

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/jobs')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Jobs
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isEditMode ? 'Edit Job' : 'Add New Job'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEditMode ? 'Update the job listing details.' : 'Create a new job listing for candidates.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Production Operator"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  placeholder="e.g., ABC Manufacturing Sdn Bhd"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select
                  value={formData.industry}
                  onValueChange={(value) => handleInputChange('industry', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {INDUSTRY_OPTIONS.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary_range">Salary Range</Label>
                <Input
                  id="salary_range"
                  placeholder="e.g., RM2000/month or RM65-115/day"
                  value={formData.salary_range}
                  onChange={(e) => handleInputChange('salary_range', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Job URL (optional)</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://101kerja.com/jobs/..."
                value={formData.url}
                onChange={(e) => handleInputChange('url', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location_state">State</Label>
                <Select
                  value={formData.location_state}
                  onValueChange={(value) => handleInputChange('location_state', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                    {MALAYSIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location_city">City</Label>
                <Input
                  id="location_city"
                  placeholder="e.g., Shah Alam"
                  value={formData.location_city}
                  onChange={(e) => handleInputChange('location_city', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Gender Requirement</Label>
              <RadioGroup
                value={formData.gender_requirement}
                onValueChange={(value) =>
                  handleInputChange('gender_requirement', value as 'any' | 'male' | 'female')
                }
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="any" id="any" />
                  <Label htmlFor="any" className="font-normal cursor-pointer">
                    Any
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="font-normal cursor-pointer">
                    Male only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="font-normal cursor-pointer">
                    Female only
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_experience_years">Min. Experience (years)</Label>
                <Input
                  id="min_experience_years"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.min_experience_years}
                  onChange={(e) =>
                    handleInputChange('min_experience_years', parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_age">Minimum Age</Label>
                <Input
                  id="min_age"
                  type="number"
                  min="16"
                  max="100"
                  placeholder="e.g., 18"
                  value={formData.min_age ?? ''}
                  onChange={(e) =>
                    handleInputChange('min_age', e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_age">Maximum Age</Label>
                <Input
                  id="max_age"
                  type="number"
                  min="16"
                  max="100"
                  placeholder="e.g., 45"
                  value={formData.max_age ?? ''}
                  onChange={(e) =>
                    handleInputChange('max_age', e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expiry */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Listing Expiry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expire By *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !expireDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expireDate ? format(expireDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expireDate}
                      onSelect={handleExpireDateChange}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-sm text-muted-foreground">
                  The job listing will be marked as expired after this date.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Quick Set</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleExpireDateChange(addDays(new Date(), 30))}
                  >
                    30 days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleExpireDateChange(addDays(new Date(), 60))}
                  >
                    60 days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleExpireDateChange(addDays(new Date(), 90))}
                  >
                    90 days
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/jobs')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? 'Update Job' : 'Create Job'}
          </Button>
        </div>
      </form>
    </div>
  );
}
