import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Job } from '@/types/database';
import { MALAYSIAN_STATES, INDUSTRY_OPTIONS } from '@/hooks/useJobs';

export interface JobEditFormData {
  title: string;
  company: string;
  location_city: string;
  location_state: string;
  industry: string;
  salary_range: string;
  gender_requirement: 'any' | 'male' | 'female';
  min_age: number | null;
  max_age: number | null;
  min_experience_years: number;
  expire_by: string;
  url: string;
}

interface JobEditFormProps {
  job: Job;
  onSave: (data: JobEditFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function JobEditForm({ job, onSave, onCancel, isSaving }: JobEditFormProps) {
  const [formData, setFormData] = useState<JobEditFormData>({
    title: job.title || '',
    company: job.company || '',
    location_city: job.location_city || '',
    location_state: job.location_state || '',
    industry: job.industry || '',
    salary_range: job.salary_range || '',
    gender_requirement: job.gender_requirement || 'any',
    min_age: job.min_age,
    max_age: job.max_age,
    min_experience_years: job.min_experience_years || 0,
    expire_by: job.expire_by || '',
    url: job.url || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expireDate, setExpireDate] = useState<Date | undefined>(
    job.expire_by ? parseISO(job.expire_by) : undefined
  );

  // Handle escape key to cancel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onCancel();
      }
    },
    [onCancel, isSaving]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleInputChange = (field: keyof JobEditFormData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setExpireDate(date);
    if (date) {
      handleInputChange('expire_by', format(date, 'yyyy-MM-dd'));
    } else {
      handleInputChange('expire_by', '');
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.company.trim()) {
      newErrors.company = 'Company is required';
    }
    if (!formData.expire_by) {
      newErrors.expire_by = 'Expiry date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSave(formData);
  };

  return (
    <Card className="shadow-sm ring-2 ring-primary/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Edit Job Details</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && <p className="text-sm text-destructive mt-1">{errors.title}</p>}
            </div>

            <div>
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                className={errors.company ? 'border-destructive' : ''}
              />
              {errors.company && <p className="text-sm text-destructive mt-1">{errors.company}</p>}
            </div>

            <div>
              <Label htmlFor="location_city">Location City</Label>
              <Input
                id="location_city"
                value={formData.location_city}
                onChange={(e) => handleInputChange('location_city', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="location_state">Location State</Label>
              <Select
                value={formData.location_state}
                onValueChange={(value) => handleInputChange('location_state', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {MALAYSIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => handleInputChange('industry', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="salary_range">Salary Range</Label>
              <Input
                id="salary_range"
                value={formData.salary_range}
                onChange={(e) => handleInputChange('salary_range', e.target.value)}
                placeholder="e.g. RM2000/month or RM65-102/day"
              />
            </div>

            <div>
              <Label htmlFor="url">URL (optional)</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => handleInputChange('url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div>
              <Label>Gender Requirement</Label>
              <RadioGroup
                value={formData.gender_requirement}
                onValueChange={(value) =>
                  handleInputChange('gender_requirement', value as 'any' | 'male' | 'female')
                }
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="any" id="gender-any" />
                  <Label htmlFor="gender-any" className="font-normal">
                    Any
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="gender-male" />
                  <Label htmlFor="gender-male" className="font-normal">
                    Male only
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="gender-female" />
                  <Label htmlFor="gender-female" className="font-normal">
                    Female only
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min_age">Min Age</Label>
                <Input
                  id="min_age"
                  type="number"
                  min={0}
                  value={formData.min_age ?? ''}
                  onChange={(e) =>
                    handleInputChange('min_age', e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
              <div>
                <Label htmlFor="max_age">Max Age</Label>
                <Input
                  id="max_age"
                  type="number"
                  min={0}
                  value={formData.max_age ?? ''}
                  onChange={(e) =>
                    handleInputChange('max_age', e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="min_experience_years">Min Experience Years</Label>
              <Input
                id="min_experience_years"
                type="number"
                min={0}
                value={formData.min_experience_years}
                onChange={(e) =>
                  handleInputChange('min_experience_years', parseInt(e.target.value) || 0)
                }
              />
            </div>

            <div>
              <Label>Expire By *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !expireDate && 'text-muted-foreground',
                      errors.expire_by && 'border-destructive'
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
                    onSelect={handleDateSelect}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
              {errors.expire_by && (
                <p className="text-sm text-destructive mt-1">{errors.expire_by}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
