import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FTP_HOST = Deno.env.get("FTP_HOST")!;
const FTP_USER = Deno.env.get("FTP_USER")!;
const FTP_PASS = Deno.env.get("FTP_PASS")!;

// ---------- FTP helpers (raw TCP) ----------

async function ftpCommand(conn: Deno.TcpConn, cmd: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  await conn.write(encoder.encode(cmd + "\r\n"));
  const buf = new Uint8Array(4096);
  const n = await conn.read(buf);
  return decoder.decode(buf.subarray(0, n ?? 0));
}

async function ftpReadResponse(conn: Deno.TcpConn): Promise<string> {
  const decoder = new TextDecoder();
  const buf = new Uint8Array(4096);
  const n = await conn.read(buf);
  return decoder.decode(buf.subarray(0, n ?? 0));
}

function parsePasvPort(response: string): { host: string; port: number } {
  const match = response.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!match) throw new Error("Failed to parse PASV response: " + response);
  const host = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
  const port = parseInt(match[5]) * 256 + parseInt(match[6]);
  return { host, port };
}

async function ftpListDirectory(dirPath: string): Promise<string> {
  const conn = await Deno.connect({ hostname: FTP_HOST, port: 21 });
  try {
    await ftpReadResponse(conn);
    let resp = await ftpCommand(conn, `USER ${FTP_USER}`);
    if (!resp.startsWith("331") && !resp.startsWith("230")) throw new Error("FTP USER failed: " + resp);
    resp = await ftpCommand(conn, `PASS ${FTP_PASS}`);
    if (!resp.startsWith("230")) throw new Error("FTP PASS failed: " + resp);
    resp = await ftpCommand(conn, "PASV");
    if (!resp.startsWith("227")) throw new Error("FTP PASV failed: " + resp);
    const { host: dataHost, port: dataPort } = parsePasvPort(resp);
    const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort });
    resp = await ftpCommand(conn, `LIST ${dirPath}`);
    if (!resp.startsWith("150") && !resp.startsWith("125")) {
      dataConn.close();
      throw new Error("FTP LIST failed: " + resp);
    }
    const chunks: Uint8Array[] = [];
    while (true) {
      const buf = new Uint8Array(65536);
      const n = await dataConn.read(buf);
      if (n === null) break;
      chunks.push(buf.subarray(0, n));
    }
    dataConn.close();
    await ftpReadResponse(conn);
    await ftpCommand(conn, "QUIT");
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }
    return new TextDecoder().decode(merged);
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

function findLatestJobsFile(listing: string): { fileName: string; dateStr: string } | null {
  const regex = /Jobs_(\d{6})\.csv/g;
  const matches: { fileName: string; dateStr: string }[] = [];
  let m;
  while ((m = regex.exec(listing)) !== null) {
    matches.push({ fileName: m[0], dateStr: m[1] });
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  return matches[0];
}

async function downloadFileFromFtp(remotePath: string): Promise<string> {
  const conn = await Deno.connect({ hostname: FTP_HOST, port: 21 });
  try {
    // Read welcome
    await ftpReadResponse(conn);

    // Login
    let resp = await ftpCommand(conn, `USER ${FTP_USER}`);
    if (!resp.startsWith("331") && !resp.startsWith("230")) throw new Error("FTP USER failed: " + resp);

    resp = await ftpCommand(conn, `PASS ${FTP_PASS}`);
    if (!resp.startsWith("230")) throw new Error("FTP PASS failed: " + resp);

    // Binary mode
    resp = await ftpCommand(conn, "TYPE I");

    // Passive mode
    resp = await ftpCommand(conn, "PASV");
    if (!resp.startsWith("227")) throw new Error("FTP PASV failed: " + resp);
    const { host: dataHost, port: dataPort } = parsePasvPort(resp);

    // Open data connection
    const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort });

    // RETR
    resp = await ftpCommand(conn, `RETR ${remotePath}`);
    if (!resp.startsWith("150") && !resp.startsWith("125")) {
      dataConn.close();
      throw new Error("FTP RETR failed: " + resp);
    }

    // Read all data
    const chunks: Uint8Array[] = [];
    while (true) {
      const buf = new Uint8Array(65536);
      const n = await dataConn.read(buf);
      if (n === null) break;
      chunks.push(buf.subarray(0, n));
    }
    dataConn.close();

    // Wait for transfer complete
    await ftpReadResponse(conn);

    // QUIT
    await ftpCommand(conn, "QUIT");

    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder().decode(merged);
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

// ---------- CSV parsing ----------

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const HEADER_ALIAS_MAP: Record<string, string> = {
  "id": "id", "no.": "id",
  "job_id": "job_id", "job id": "job_id",
  "job_title": "job_title", "job title": "job_title",
  "job_type": "job_type", "job type": "job_type",
  "company_name": "company_name", "company name": "company_name",
  "location": "location",
  "postcode": "postcode",
  "city": "city", "state": "state", "country": "country",
  "salary_range": "salary_range", "salary range": "salary_range",
  "wages_per_month": "_ignore", "wages per month (rm)": "_ignore",
  "wages_per_day": "_ignore", "wages per day (rm)": "_ignore",
  "gender_requirement": "gender_requirement", "gender requirement": "gender_requirement",
  "url": "url",
  "created_at": "created_at",
  "end_date": "end_date", "end date": "end_date",
  "age_min": "age_min", "age min": "age_min",
  "age_max": "age_max", "age max": "age_max",
  "branch": "branch", "status": "status",
  "company id": "_ignore", "reference no.": "_ignore",
  "start date": "_ignore", "no. of required": "_ignore",
  "applicants": "_ignore", "no. of workers": "_ignore",
  "team lead": "_ignore", "num. of shifts": "_ignore",
  "branch manager": "_ignore", "supervisor": "_ignore",
};

const INTERNAL_FIELDS = [
  "id", "job_id", "job_title", "job_type", "company_name", "location", "postcode",
  "city", "state", "country", "salary_range", "gender_requirement", "url",
  "created_at", "end_date", "age_min", "age_max", "branch", "status",
];

interface CsvRow { [key: string]: string }

function parseCsv(content: string): { rows: CsvRow[]; error: string | null } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: "CSV has no data rows" };

  const rawHeaders = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const mapped = rawHeaders.map((h) => HEADER_ALIAS_MAP[h] ?? (INTERNAL_FIELDS.includes(h) ? h : "_ignore"));

  if (!mapped.includes("job_title") || !mapped.includes("end_date")) {
    return { rows: [], error: "Missing required columns: job_title and/or end_date" };
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const row: CsvRow = {};
    for (const f of INTERNAL_FIELDS) row[f] = "";
    for (let j = 0; j < mapped.length; j++) {
      if (mapped[j] !== "_ignore") row[mapped[j]] = vals[j] ?? "";
    }
    rows.push(row);
  }
  return { rows, error: null };
}

// ---------- Normalization ----------

function clean(val: string): string {
  const t = val.trim();
  return t.toUpperCase() === "NULL" ? "" : t;
}

function convertDate(raw: string): string | null {
  const c = clean(raw);
  if (!c) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return isNaN(new Date(c).getTime()) ? null : c;
  const m = c.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isNaN(new Date(iso).getTime()) ? null : iso;
}

function normalizeGender(raw: string): string {
  const c = clean(raw).toLowerCase();
  if (c === "1") return "male";
  if (c === "2") return "any";
  if (c === "both") return "any";
  if (c === "male") return "male";
  if (c === "female") return "female";
  if (!c) return "female";
  return c;
}

function normalizeStatus(raw: string): string {
  const c = clean(raw).toLowerCase();
  return c || "active";
}

// ---------- Location resolution ----------

interface MalaysiaLocation {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  aliases: string[] | null;
}

function resolveLocation(
  city: string, state: string, locationField: string, locations: MalaysiaLocation[]
): { latitude: number; longitude: number } | null {
  const cityClean = clean(city).toLowerCase();
  const stateClean = clean(state).toLowerCase();
  const locClean = clean(locationField).toLowerCase().replace(/,\s*$/, "").trim();

  const matches = (loc: MalaysiaLocation, candidate: string) =>
    loc.name.toLowerCase() === candidate ||
    (loc.aliases ?? []).some((a) => a.toLowerCase() === candidate);
  const stateFilter = (loc: MalaysiaLocation) =>
    !stateClean || loc.state.toLowerCase() === stateClean;

  if (cityClean) {
    const m = locations.find((l) => stateFilter(l) && matches(l, cityClean));
    if (m) return { latitude: m.latitude, longitude: m.longitude };
  }
  if (locClean) {
    const m = locations.find((l) => stateFilter(l) && matches(l, locClean));
    if (m) return { latitude: m.latitude, longitude: m.longitude };
  }
  const candidate = cityClean || locClean;
  if (candidate) {
    const m = locations.find((l) => matches(l, candidate));
    if (m) return { latitude: m.latitude, longitude: m.longitude };
  }
  return null;
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let dateStr = url.searchParams.get("date");

    // Default to today in MYT (UTC+8)
    if (!dateStr) {
      const now = new Date();
      const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const yy = String(myt.getUTCFullYear()).slice(-2);
      const mm = String(myt.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(myt.getUTCDate()).padStart(2, "0");
      dateStr = `${yy}${mm}${dd}`;
    }

    const fileName = `Jobs_${dateStr}.csv`;
    const remotePath = `/production/${fileName}`;

    console.log(`Downloading ${remotePath} from FTP...`);
    let csvContent: string;
    try {
      csvContent = await downloadFileFromFtp(remotePath);
    } catch (ftpErr: any) {
      return new Response(
        JSON.stringify({ error: `FTP download failed: ${ftpErr.message}`, date: dateStr, fileName }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Downloaded ${csvContent.length} bytes, parsing CSV...`);
    const { rows, error: parseErr } = parseCsv(csvContent);
    if (parseErr) {
      return new Response(
        JSON.stringify({ error: parseErr, date: dateStr, fileName }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch locations for geocoding
    const { data: locData } = await supabaseAdmin
      .from("malaysia_locations")
      .select("name, state, latitude, longitude, aliases");
    const locations: MalaysiaLocation[] = locData ?? [];

    // Fetch existing jobs by external_job_id
    const existingMap = new Map<string, { id: string; location_city: string | null; location_state: string | null; postcode: string | null; location_address: string | null; url: string | null; job_type: string | null; branch: string | null; status: string | null }>();
    let from = 0;
    while (true) {
      const { data } = await supabaseAdmin
        .from("jobs")
        .select("id, external_job_id, location_city, location_state, postcode, location_address, url, job_type, branch, status")
        .not("external_job_id", "is", null)
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const j of data) {
        if (j.external_job_id) existingMap.set(j.external_job_id, j as any);
      }
      if (data.length < 1000) break;
      from += 1000;
    }

    let inserted = 0, updated = 0, skipped = 0, errors: string[] = [];
    const CHUNK = 50;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const inserts: any[] = [];
      const updates: { id: string; data: any }[] = [];

      for (const raw of chunk) {
        const title = clean(raw.job_title);
        if (!title) { errors.push(`Row: missing job_title`); continue; }

        const expireDate = convertDate(raw.end_date);
        if (!expireDate) { errors.push(`Row ${raw.job_id || "?"}: invalid end_date`); continue; }

        const gender = normalizeGender(raw.gender_requirement);
        const status = normalizeStatus(raw.status);
        const jobId = clean(raw.job_id);

        const geo = resolveLocation(raw.city, raw.state, raw.location, locations);

        const record: any = {
          title,
          job_type: clean(raw.job_type) || null,
          company: clean(raw.company_name) || null,
          location_address: clean(raw.location) || null,
          postcode: clean(raw.postcode) || null,
          location_city: clean(raw.city) || null,
          location_state: clean(raw.state) || null,
          country: clean(raw.country) || "Malaysia",
          salary_range: clean(raw.salary_range) || null,
          gender_requirement: gender,
          url: clean(raw.url) || null,
          expire_by: expireDate,
          min_age: clean(raw.age_min) ? parseInt(raw.age_min) : 18,
          max_age: clean(raw.age_max) ? parseInt(raw.age_max) : 60,
          branch: clean(raw.branch) || null,
          status,
          external_job_id: jobId || null,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
        };

        const existing = jobId ? existingMap.get(jobId) : undefined;
        if (existing) {
          updates.push({ id: existing.id, data: { ...record, last_edited_at: new Date().toISOString() } });
        } else {
          inserts.push(record);
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabaseAdmin.from("jobs").insert(inserts);
        if (error) errors.push(`Insert error: ${error.message}`);
        else inserted += inserts.length;
      }

      for (const upd of updates) {
        const { error } = await supabaseAdmin.from("jobs").update(upd.data).eq("id", upd.id);
        if (error) errors.push(`Update error (${upd.id}): ${error.message}`);
        else updated++;
      }
    }

    skipped = rows.length - inserted - updated - errors.length;

    const result = { inserted, updated, skipped, errors: errors.length, errorDetails: errors.slice(0, 20), date: dateStr, fileName, totalRows: rows.length };
    console.log("Import result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("FTP import error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
