import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useJobById,
  useCreateJob,
  useUpdateJob,
  POSITION_OPTIONS,
  defaultJobFormData,
  type JobFormData,
} from '@/hooks/useJobForm';
import { MALAYSIAN_STATES } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { format, parseISO } from 'date-fns';
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
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditMode && existingJob) {
      setFormData({
        job_title: existingJob.job_title,
        position: existingJob.position,
        job_type: existingJob.job_type,
        hourly_rate: existingJob.hourly_rate,
        branch_name: existingJob.branch_name || '',
        location_city: existingJob.location_city || '',
        location_state: existingJob.location_state || '',
        location_postcode: existingJob.location_postcode || '',
        gender_requirement: existingJob.gender_requirement as 'any' | 'male' | 'female',
        age_min: existingJob.age_min,
        age_max: existingJob.age_max,
        is_oku_friendly: existingJob.is_oku_friendly,
        num_shifts: existingJob.num_shifts,
        start_date: existingJob.start_date,
        end_date: existingJob.end_date,
        slots_available: existingJob.slots_available,
        whatsapp_group_link: existingJob.whatsapp_group_link || '',
      });
      if (existingJob.start_date) setStartDate(parseISO(existingJob.start_date));
      if (existingJob.end_date) setEndDate(parseISO(existingJob.end_date));
    }
  }, [isEditMode, existingJob]);

  const handleInputChange = (field: keyof JobFormData, value: string | number | boolean | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: 'start_date' | 'end_date', date: Date | undefined) => {
    if (field === 'start_date') {
      setStartDate(date);
      handleInputChange('start_date', date ? format(date, 'yyyy-MM-dd') : null);
    } else {
      setEndDate(date);
      handleInputChange('end_date', date ? format(date, 'yyyy-MM-dd') : null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.job_title.trim()) {
      toast({ title: 'Validation Error', description: 'Job title is required.', variant: 'destructive' });
      return;
    }
    if (!formData.position) {
      toast({ title: 'Validation Error', description: 'Position is required.', variant: 'destructive' });
      return;
    }
    if (!formData.whatsapp_group_link.trim()) {
      toast({ title: 'Validation Error', description: 'WhatsApp group link is required.', variant: 'destructive' });
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
                <Label htmlFor="job_title">Job Title *</Label>
                <Input
                  id="job_title"
                  placeholder="e.g., Cashier at ABC Mall"
                  value={formData.job_title}
                  onChange={(e) => handleInputChange('job_title', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position *</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value) => handleInputChange('position', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {POSITION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Type *</Label>
                <RadioGroup
                  value={formData.job_type?.toString() || '1'}
                  onValueChange={(value) => handleInputChange('job_type', parseInt(value))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="part_time" />
                    <Label htmlFor="part_time" className="font-normal cursor-pointer">
                      Part-time
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2" id="full_time" />
                    <Label htmlFor="full_time" className="font-normal cursor-pointer">
                      Full-time
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Hourly Rate (RM)</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 12.00"
                  value={formData.hourly_rate ?? ''}
                  onChange={(e) =>
                    handleInputChange('hourly_rate', e.target.value ? parseFloat(e.target.value) : null)
                  }
                />
              </div>
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
                <Label htmlFor="branch_name">Branch Name</Label>
                <Input
                  id="branch_name"
                  placeholder="e.g., ABC Mall Bukit Bintang"
                  value={formData.branch_name}
                  onChange={(e) => handleInputChange('branch_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location_city">City</Label>
                <Input
                  id="location_city"
                  placeholder="e.g., Kuala Lumpur"
                  value={formData.location_city}
                  onChange={(e) => handleInputChange('location_city', e.target.value)}
                />
              </div>
            </div>
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
                <Label htmlFor="location_postcode">Postcode</Label>
                <Input
                  id="location_postcode"
                  placeholder="e.g., 50100"
                  value={formData.location_postcode}
                  onChange={(e) => handleInputChange('location_postcode', e.target.value)}
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

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age_min">Minimum Age</Label>
                <Input
                  id="age_min"
                  type="number"
                  min="16"
                  max="100"
                  placeholder="e.g., 18"
                  value={formData.age_min ?? ''}
                  onChange={(e) =>
                    handleInputChange('age_min', e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age_max">Maximum Age</Label>
                <Input
                  id="age_max"
                  type="number"
                  min="16"
                  max="100"
                  placeholder="e.g., 45"
                  value={formData.age_max ?? ''}
                  onChange={(e) =>
                    handleInputChange('age_max', e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_oku_friendly"
                checked={formData.is_oku_friendly}
                onCheckedChange={(checked) => handleInputChange('is_oku_friendly', checked === true)}
              />
              <Label htmlFor="is_oku_friendly" className="font-normal cursor-pointer">
                OKU Friendly (suitable for persons with disabilities)
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="num_shifts">Number of Shifts</Label>
                <Input
                  id="num_shifts"
                  type="number"
                  min="1"
                  placeholder="e.g., 3"
                  value={formData.num_shifts ?? ''}
                  onChange={(e) =>
                    handleInputChange('num_shifts', e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slots_available">Slots Available</Label>
                <Input
                  id="slots_available"
                  type="number"
                  min="1"
                  placeholder="e.g., 10"
                  value={formData.slots_available}
                  onChange={(e) =>
                    handleInputChange('slots_available', parseInt(e.target.value) || 1)
                  }
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !startDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => handleDateChange('start_date', date)}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => handleDateChange('end_date', date)}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="whatsapp_group_link">WhatsApp Group Link *</Label>
              <Input
                id="whatsapp_group_link"
                placeholder="https://chat.whatsapp.com/..."
                value={formData.whatsapp_group_link}
                onChange={(e) => handleInputChange('whatsapp_group_link', e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                The group link candidates will join after verification.
              </p>
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
