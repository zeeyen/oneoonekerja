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
  gender_requirement: string;
  url: string;
  created_at: string;
  end_date: string;
  age_min: string;
  age_max: string;
}

export type ResolutionMethod = 'local' | 'ai' | null;

export interface ParsedRow {
  rowNumber: number;
  raw: CsvRow;
  latitude: number | null;
  longitude: number | null;
  locationResolved: boolean;
  resolutionMethod: ResolutionMethod;
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
  'city', 'state', 'country', 'salary_range', 'gender_requirement',
  'url', 'created_at', 'end_date', 'age_min', 'age_max',
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
    (csvRows: CsvRow[]): ParsedRow[] => {
      return csvRows.map((raw, i) => {
        const errors = validateRow(raw);
        const resolved = resolveLocation(raw.city, raw.state, raw.location, locations);
        return {
          rowNumber: i + 1,
          raw,
          latitude: resolved?.latitude ?? null,
          longitude: resolved?.longitude ?? null,
          locationResolved: resolved !== null,
          resolutionMethod: resolved ? 'local' as ResolutionMethod : null,
          errors,
        };
      });
    },
    [locations],
  );

  const resolveWithAi = useCallback(
    async (rows: ParsedRow[]): Promise<ParsedRow[]> => {
      const unresolvedIndices = rows
        .map((r, i) => (!r.locationResolved && r.errors.length === 0 ? i : -1))
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

  const importRows = useCallback(
    async (rows: ParsedRow[]): Promise<{ inserted: number; locationWarnings: number }> => {
      const validRows = rows.filter((r) => r.errors.length === 0);
      if (validRows.length === 0) throw new Error('No valid rows to import');

      setImporting(true);
      setProgress(0);
      let inserted = 0;
      let locationWarnings = 0;

      try {
        for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
          const chunk = validRows.slice(i, i + CHUNK_SIZE);
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
          setProgress(Math.round((inserted / validRows.length) * 100));
        }

        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['jobs-active-count'] });
        return { inserted, locationWarnings };
      } finally {
        setImporting(false);
      }
    },
    [user, queryClient],
  );

  return {
    fetchLocations,
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
