

## Add Salary Display Helper for Marketing Optimization

### Changes

**1. jobs.ts — Add displaySalary helper and update usage**

- Insert helper function before `formatJobsMessage` (around line 239):
```typescript
function displaySalary(salaryRange: string): string {
  const rangeMatch = salaryRange.match(/RM\s*[\d,.]+\s*-\s*(RM\s*[\d,.]+\/\w+)/)
  if (rangeMatch) {
    return rangeMatch[1]
  }
  return salaryRange
}
```

- Update line 289 from:
```typescript
const salary = job.salary_range || getText(language, { ms: 'Gaji negotiate', en: 'Negotiable', zh: '面议' })
```
to:
```typescript
const salary = (job.salary_range ? displaySalary(job.salary_range) : null) || getText(language, { ms: 'Gaji negotiate', en: 'Negotiable', zh: '面议' })
```

**2. matching.ts — Add displaySalary helper and update usage**

- Insert helper function after imports (around line 13):
```typescript
function displaySalary(salaryRange: string): string {
  const rangeMatch = salaryRange.match(/RM\s*[\d,.]+\s*-\s*(RM\s*[\d,.]+\/\w+)/)
  if (rangeMatch) {
    return rangeMatch[1]
  }
  return salaryRange
}
```

- Update line 181 from:
```typescript
const salary = selectedJob.salary_range || getText(lang, { ms: 'Gaji negotiate', en: 'Salary negotiable', zh: '薪资面议' })
```
to:
```typescript
const salary = (selectedJob.salary_range ? displaySalary(selectedJob.salary_range) : null) || getText(lang, { ms: 'Gaji negotiate', en: 'Salary negotiable', zh: '薪资面议' })
```

### Impact
- Ranges like "RM 102.00 - RM 120.00/day" → displays "RM 120.00/day"
- Single values like "RM 110.00/day" → unchanged ("RM 110.00/day")
- Marketing benefit: Higher end of range attracts more applicants

### Deployment
Redeploy the `bot-processor` Edge Function after both edits.

