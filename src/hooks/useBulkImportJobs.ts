import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/** Columns as they appear in the source CSV export */
export interface CsvRow {
  id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  location: string;
  postcode: string;
  city: string;
  state: string;
  country: string;
  salary_range: string;
  wages_per_month: string;
  wages_per_day: string;
  gender_requirement: string;
  url: string;
  created_at: string;
  end_date: string;
  age_min: string;
  age_max: string;
}

export type ResolutionMethod = 'local' | 'ai' | null;

export interface ExistingJobData {
  id: string;
  location_address: string | null;
  postcode: string | null;
  location_city: string | null;
  location_state: string | null;
  url: string | null;
}

export interface ParsedRow {
  rowNumber: number;
  raw: CsvRow;
  latitude: number | null;
  longitude: number | null;
  locationResolved: boolean;
  resolutionMethod: ResolutionMethod;
  isExisting: boolean;
  hasLocationChanges: boolean;
  locationChanges: string[];
  existingJobDbId: string | null;
  errors: string[];
}

interface MalaysiaLocation {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  aliases: string[] | null;
}

const CSV_HEADERS = [
  'id', 'job_id', 'job_title', 'company_name', 'location', 'postcode',
  'city', 'state', 'country', 'salary_range', 'wages_per_month', 'wages_per_day',
  'gender_requirement', 'url', 'created_at', 'end_date', 'age_min', 'age_max',
] as const;

const CHUNK_SIZE = 50;
const AI_DELAY_MS = 200;

export function generateCsvTemplate(): string {
  return CSV_HEADERS.join(',') + '\n';
}

/** Treat literal "NULL" (case-insensitive) as empty */
function cleanNull(val: string): string {
  return val.trim().toUpperCase() === 'NULL' ? '' : val.trim();
}

/** Normalize a value for comparison: lowercase, trim, treat null/empty/"NULL" as empty string */
function normalizeForCompare(val: string | null | undefined): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.toUpperCase() === 'NULL') return '';
  return trimmed.toLowerCase();
}

/** Convert DD/MM/YYYY to YYYY-MM-DD. Returns null if invalid. */
function convertDate(raw: string): string | null {
  const cleaned = cleanNull(raw);
  if (!cleaned) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return isNaN(new Date(cleaned).getTime()) ? null : cleaned;
  }
  const match = cleaned.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  return isNaN(new Date(iso).getTime()) ? null : iso;
}

/** Map gender values: "Both" → "any", etc. */
function normalizeGender(raw: string): string {
  const cleaned = cleanNull(raw).toLowerCase();
  if (!cleaned || cleaned === 'both') return 'any';
  return cleaned;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsvContent(content: string): { rows: CsvRow[]; headerError: string | null } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], headerError: 'CSV must have a header row and at least one data row.' };

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const required = ['job_title', 'end_date'] as const;
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { rows: [], headerError: `Missing required columns: ${missing.join(', ')}` };
  }

  const headerIndex = Object.fromEntries(headers.map((h, i) => [h, i]));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (const h of CSV_HEADERS) {
      row[h] = headerIndex[h] !== undefined ? (values[headerIndex[h]] ?? '') : '';
    }
    rows.push(row as unknown as CsvRow);
  }

  return { rows, headerError: null };
}

function validateRow(raw: CsvRow): string[] {
  const errors: string[] = [];
  if (!cleanNull(raw.job_title)) errors.push('Job title is required');

  const dateVal = cleanNull(raw.end_date);
  if (!dateVal) {
    errors.push('End date is required');
  } else if (!convertDate(raw.end_date)) {
    errors.push('End date must be DD/MM/YYYY or YYYY-MM-DD');
  }

  const gender = normalizeGender(raw.gender_requirement);
  if (!['any', 'male', 'female'].includes(gender)) errors.push('Gender must be any, male, female, or Both');

  const ageMin = cleanNull(raw.age_min);
  const ageMax = cleanNull(raw.age_max);
  if (ageMin && isNaN(Number(ageMin))) errors.push('age_min must be a number');
  if (ageMax && isNaN(Number(ageMax))) errors.push('age_max must be a number');

  return errors;
}

function resolveLocation(
  city: string,
  state: string,
  locationField: string,
  locations: MalaysiaLocation[],
): { latitude: number; longitude: number } | null {
  const cityClean = cleanNull(city).toLowerCase();
  const stateClean = cleanNull(state).toLowerCase();
  const locationClean = cleanNull(locationField).toLowerCase().replace(/,\s*$/, '').trim();

  const matches = (loc: MalaysiaLocation, candidate: string) =>
    loc.name.toLowerCase() === candidate ||
    (loc.aliases ?? []).some((a) => a.toLowerCase() === candidate);

  const stateFilter = (loc: MalaysiaLocation) =>
    !stateClean || loc.state.toLowerCase() === stateClean;

  if (cityClean) {
    const m = locations.find((loc) => stateFilter(loc) && matches(loc, cityClean));
    if (m) return { latitude: m.latitude, longitude: m.longitude };
  }

  if (locationClean) {
    const m = locations.find((loc) => stateFilter(loc) && matches(loc, locationClean));
    if (m) return { latitude: m.latitude, longitude: m.longitude };
  }

  const candidate = cityClean || locationClean;
  if (candidate) {
    const m = locations.find((loc) => matches(loc, candidate));
    if (m) return { latitude: m.latitude, longitude: m.longitude };
  }

  return null;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch all existing jobs with their location data, keyed by external_job_id */
async function fetchExistingJobs(): Promise<Map<string, ExistingJobData>> {
  const jobsMap = new Map<string, ExistingJobData>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, external_job_id, location_address, postcode, location_city, location_state, url')
      .not('external_job_id', 'is', null)
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      if (row.external_job_id) {
        jobsMap.set(row.external_job_id, {
          id: row.id,
          location_address: row.location_address,
          postcode: row.postcode,
          location_city: row.location_city,
          location_state: row.location_state,
        });
      }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return jobsMap;
}

/** Backward-compatible alias */
async function fetchExistingJobIds(): Promise<Set<string>> {
  const map = await fetchExistingJobs();
  return new Set(map.keys());
}

/** Detect which location fields changed between CSV and DB */
function detectLocationChanges(raw: CsvRow, existing: ExistingJobData): string[] {
  const changes: string[] = [];
  if (normalizeForCompare(cleanNull(raw.location)) !== normalizeForCompare(existing.location_address)) changes.push('location');
  if (normalizeForCompare(cleanNull(raw.postcode)) !== normalizeForCompare(existing.postcode)) changes.push('postcode');
  if (normalizeForCompare(cleanNull(raw.city)) !== normalizeForCompare(existing.location_city)) changes.push('city');
  if (normalizeForCompare(cleanNull(raw.state)) !== normalizeForCompare(existing.location_state)) changes.push('state');
  if (normalizeForCompare(cleanNull(raw.url)) !== normalizeForCompare(existing.url)) changes.push('url');
  return changes;
}

export function useBulkImportJobs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [locations, setLocations] = useState<MalaysiaLocation[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [aiResolving, setAiResolving] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });

  const fetchLocations = useCallback(async () => {
    if (locationsLoaded) return;
    const { data, error } = await supabase
      .from('malaysia_locations')
      .select('name, state, latitude, longitude, aliases');
    if (!error && data) {
      setLocations(data);
      setLocationsLoaded(true);
    }
  }, [locationsLoaded]);

  const processRows = useCallback(
    (csvRows: CsvRow[], existingJobs?: Map<string, ExistingJobData>): ParsedRow[] => {
      return csvRows.map((raw, i) => {
        const errors = validateRow(raw);
        const resolved = resolveLocation(raw.city, raw.state, raw.location, locations);
        const jobId = cleanNull(raw.job_id);
        const existingJob = jobId ? existingJobs?.get(jobId) : undefined;
        const isExisting = !!existingJob;

        let hasLocationChanges = false;
        let locationChanges: string[] = [];
        let existingJobDbId: string | null = null;

        if (isExisting && existingJob) {
          existingJobDbId = existingJob.id;
          locationChanges = detectLocationChanges(raw, existingJob);
          hasLocationChanges = locationChanges.length > 0;
        }

        return {
          rowNumber: i + 1,
          raw,
          latitude: resolved?.latitude ?? null,
          longitude: resolved?.longitude ?? null,
          locationResolved: resolved !== null,
          resolutionMethod: resolved ? 'local' as ResolutionMethod : null,
          isExisting,
          hasLocationChanges,
          locationChanges,
          existingJobDbId,
          errors,
        };
      });
    },
    [locations],
  );

  const resolveWithAi = useCallback(
    async (rows: ParsedRow[]): Promise<ParsedRow[]> => {
      // Include both new rows and existing rows with location changes that need coordinates
      const unresolvedIndices = rows
        .map((r, i) => {
          if (r.errors.length > 0) return -1;
          if (r.locationResolved) return -1;
          // New rows
          if (!r.isExisting) return i;
          // Existing rows with location changes needing re-resolution
          if (r.hasLocationChanges) return i;
          return -1;
        })
        .filter((i) => i !== -1);

      if (unresolvedIndices.length === 0) return rows;

      setAiResolving(true);
      setAiProgress({ current: 0, total: unresolvedIndices.length });

      const updated = [...rows];
      let rateLimited = false;

      for (let idx = 0; idx < unresolvedIndices.length; idx++) {
        if (rateLimited) break;

        const rowIdx = unresolvedIndices[idx];
        const row = updated[rowIdx];

        try {
          const { data, error } = await supabase.functions.invoke('geocode-location', {
            body: {
              city: cleanNull(row.raw.city),
              state: cleanNull(row.raw.state),
              location_address: cleanNull(row.raw.location),
              postcode: cleanNull(row.raw.postcode),
              country: cleanNull(row.raw.country) || 'Malaysia',
            },
          });

          if (error) {
            console.warn('AI geocode error for row', row.rowNumber, error);
          } else if (data?.latitude != null && data?.longitude != null) {
            updated[rowIdx] = {
              ...row,
              latitude: data.latitude,
              longitude: data.longitude,
              locationResolved: true,
              resolutionMethod: 'ai' as ResolutionMethod,
            };
          } else if (data?.error === 'rate_limited' || data?.error === 'payment_required') {
            rateLimited = true;
            console.warn('AI geocoding stopped:', data.error);
          }
        } catch (e) {
          console.warn('AI geocode call failed for row', row.rowNumber, e);
        }

        setAiProgress({ current: idx + 1, total: unresolvedIndices.length });

        if (idx < unresolvedIndices.length - 1 && !rateLimited) {
          await delay(AI_DELAY_MS);
        }
      }

      setAiResolving(false);
      return updated;
    },
    [],
  );

  const updateExistingRows = useCallback(
    async (rows: ParsedRow[]): Promise<{ updated: number }> => {
      const toUpdate = rows.filter((r) => r.isExisting && r.hasLocationChanges && r.existingJobDbId);
      if (toUpdate.length === 0) return { updated: 0 };

      let updated = 0;
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
        for (const row of chunk) {
          const { error } = await supabase
            .from('jobs')
            .update({
              location_address: cleanNull(row.raw.location) || null,
              postcode: cleanNull(row.raw.postcode) || null,
              location_city: cleanNull(row.raw.city) || null,
              location_state: cleanNull(row.raw.state) || null,
              latitude: row.latitude,
              longitude: row.longitude,
              last_edited_at: new Date().toISOString(),
              last_edited_by: user?.id ?? null,
            })
            .eq('id', row.existingJobDbId!);
          if (error) {
            console.error('Failed to update job', row.existingJobDbId, error);
          } else {
            updated++;
          }
        }
      }
      return { updated };
    },
    [user],
  );

  const importRows = useCallback(
    async (rows: ParsedRow[]): Promise<{ inserted: number; skipped: number; updated: number; locationWarnings: number }> => {
      const newValidRows = rows.filter((r) => r.errors.length === 0 && !r.isExisting);
      const updateRows = rows.filter((r) => r.isExisting && r.hasLocationChanges);
      const skipped = rows.filter((r) => r.isExisting && !r.hasLocationChanges).length;

      if (newValidRows.length === 0 && updateRows.length === 0) throw new Error('No new or updatable rows to process');

      setImporting(true);
      setProgress(0);
      let inserted = 0;
      let locationWarnings = 0;
      const totalWork = newValidRows.length + updateRows.length;

      try {
        // Update existing rows with location changes
        const { updated } = await updateExistingRows(rows);
        setProgress(totalWork > 0 ? Math.round((updateRows.length / totalWork) * 100) : 0);

        // Insert new rows
        for (let i = 0; i < newValidRows.length; i += CHUNK_SIZE) {
          const chunk = newValidRows.slice(i, i + CHUNK_SIZE);
          const records = chunk.map((r) => {
            if (!r.locationResolved) locationWarnings++;
            const cityClean = cleanNull(r.raw.city);
            const stateClean = cleanNull(r.raw.state);
            return {
              title: cleanNull(r.raw.job_title),
              company: cleanNull(r.raw.company_name) || null,
              industry: null,
              location_city: cityClean || null,
              location_state: stateClean || null,
              location_address: cleanNull(r.raw.location) || null,
              postcode: cleanNull(r.raw.postcode) || null,
              country: cleanNull(r.raw.country) || 'Malaysia',
              external_job_id: cleanNull(r.raw.job_id) || null,
              latitude: r.latitude,
              longitude: r.longitude,
              salary_range: cleanNull(r.raw.salary_range) || null,
              gender_requirement: normalizeGender(r.raw.gender_requirement),
              min_age: cleanNull(r.raw.age_min) ? Number(r.raw.age_min) : 18,
              max_age: cleanNull(r.raw.age_max) ? Number(r.raw.age_max) : 60,
              min_experience_years: 0,
              expire_by: convertDate(r.raw.end_date)!,
              url: cleanNull(r.raw.url) || null,
              last_edited_at: new Date().toISOString(),
              last_edited_by: user?.id ?? null,
            };
          });

          const { error } = await supabase.from('jobs').insert(records);
          if (error) throw error;
          inserted += chunk.length;
          setProgress(Math.round(((updateRows.length + inserted) / totalWork) * 100));
        }

        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['jobs-active-count'] });
        return { inserted, skipped, updated, locationWarnings };
      } finally {
        setImporting(false);
      }
    },
    [user, queryClient, updateExistingRows],
  );

  return {
    fetchLocations,
    fetchExistingJobIds,
    fetchExistingJobs,
    locationsLoaded,
    processRows,
    resolveWithAi,
    aiResolving,
    aiProgress,
    importRows,
    importing,
    progress,
  };
}
