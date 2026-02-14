
CREATE OR REPLACE FUNCTION get_job_match_counts(since_ts timestamptz DEFAULT NULL)
RETURNS TABLE(job_id uuid, match_count bigint) AS $$
  SELECT 
    (elem->>'id')::uuid as job_id,
    count(DISTINCT a.id) as match_count
  FROM applicants a,
    jsonb_array_elements(a.conversation_state->'matched_jobs') as elem
  WHERE a.conversation_state->'matched_jobs' IS NOT NULL
    AND jsonb_array_length(a.conversation_state->'matched_jobs') > 0
    AND (since_ts IS NULL OR a.updated_at >= since_ts)
  GROUP BY (elem->>'id')::uuid
  ORDER BY match_count DESC;
$$ LANGUAGE sql STABLE
SET search_path = public;
