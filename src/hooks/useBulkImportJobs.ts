import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface CsvRow {
  title: string;
  company: string;
  industry: string;
  location_city: string;
  location_state: string;
  salary_range: string;
  gender_requirement: string;
  min_age: string;
  max_age: string;
  min_experience_years: string;
  expire_by: string;
  url: string;
}

export interface ParsedRow {
  rowNumber: number;
  raw: CsvRow;
  latitude: number | null;
  longitude: number | null;
  locationResolved: boolean;
  errors: string[];
}

interface MalaysiaLocation {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
}

const CSV_HEADERS = [
  'title', 'company', 'industry', 'location_city', 'location_state',
  'salary_range', 'gender_requirement', 'min_age', 'max_age',
  'min_experience_years', 'expire_by', 'url',
] as const;

const VALID_GENDERS = ['any', 'male', 'female'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CHUNK_SIZE = 50;

export function generateCsvTemplate(): string {
  return CSV_HEADERS.join(',') + '\n';
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
  const missing = CSV_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { rows: [], headerError: `Missing columns: ${missing.join(', ')}` };
  }

  const headerIndex = Object.fromEntries(headers.map((h, i) => [h, i]));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (const h of CSV_HEADERS) {
      row[h] = values[headerIndex[h]] ?? '';
    }
    rows.push(row as unknown as CsvRow);
  }

  return { rows, headerError: null };
}

function validateRow(raw: CsvRow): string[] {
  const errors: string[] = [];
  if (!raw.title.trim()) errors.push('Title is required');
  if (!raw.expire_by.trim()) {
    errors.push('Expire date is required');
  } else if (!DATE_REGEX.test(raw.expire_by.trim())) {
    errors.push('Expire date must be YYYY-MM-DD');
  } else if (isNaN(new Date(raw.expire_by.trim()).getTime())) {
    errors.push('Expire date is invalid');
  }
  const gender = (raw.gender_requirement || 'any').toLowerCase().trim();
  if (!VALID_GENDERS.includes(gender)) errors.push('Gender must be any, male, or female');
  if (raw.min_age && isNaN(Number(raw.min_age))) errors.push('Min age must be a number');
  if (raw.max_age && isNaN(Number(raw.max_age))) errors.push('Max age must be a number');
  if (raw.min_experience_years && isNaN(Number(raw.min_experience_years))) errors.push('Experience must be a number');
  return errors;
}

function resolveLocation(
  city: string,
  state: string,
  locations: MalaysiaLocation[],
): { latitude: number; longitude: number } | null {
  if (!city.trim()) return null;
  const cityLower = city.trim().toLowerCase();
  const stateLower = state.trim().toLowerCase();

  const match = locations.find(
    (loc) =>
      loc.name.toLowerCase() === cityLower &&
      (!stateLower || loc.state.toLowerCase() === stateLower),
  );
  return match ? { latitude: match.latitude, longitude: match.longitude } : null;
}

export function useBulkImportJobs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [locations, setLocations] = useState<MalaysiaLocation[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchLocations = useCallback(async () => {
    if (locationsLoaded) return;
    const { data, error } = await supabase
      .from('malaysia_locations')
      .select('name, state, latitude, longitude');
    if (!error && data) {
      setLocations(data);
      setLocationsLoaded(true);
    }
  }, [locationsLoaded]);

  const processRows = useCallback(
    (csvRows: CsvRow[]): ParsedRow[] => {
      return csvRows.map((raw, i) => {
        const errors = validateRow(raw);
        const resolved = resolveLocation(raw.location_city, raw.location_state, locations);
        return {
          rowNumber: i + 1,
          raw,
          latitude: resolved?.latitude ?? null,
          longitude: resolved?.longitude ?? null,
          locationResolved: resolved !== null,
          errors,
        };
      });
    },
    [locations],
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
            const gender = (r.raw.gender_requirement || 'any').toLowerCase().trim();
            return {
              title: r.raw.title.trim(),
              company: r.raw.company.trim() || null,
              industry: r.raw.industry.trim() || null,
              location_city: r.raw.location_city.trim() || null,
              location_state: r.raw.location_state.trim() || null,
              latitude: r.latitude,
              longitude: r.longitude,
              salary_range: r.raw.salary_range.trim() || null,
              gender_requirement: gender,
              min_age: r.raw.min_age ? Number(r.raw.min_age) : 18,
              max_age: r.raw.max_age ? Number(r.raw.max_age) : 60,
              min_experience_years: r.raw.min_experience_years ? Number(r.raw.min_experience_years) : 0,
              expire_by: r.raw.expire_by.trim(),
              url: r.raw.url.trim() || null,
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
    importRows,
    importing,
    progress,
  };
}
