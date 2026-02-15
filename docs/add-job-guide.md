# Adding a New Job Type

This guide explains how to add a new job type to MASSVISION Reap3r end-to-end.

## Steps

### 1. Define the Job Type in Shared Package

**File:** `packages/shared/src/jobs.ts`

```typescript
// Add to JobType union
export type JobType =
  | 'run_script'
  | 'your_new_job'    // ← Add here
  | ...

// Add payload interface
export interface YourNewJobPayload {
  param1: string;
  param2: number;
  optional_param?: boolean;
}

// Add to JOB_TYPE_PERMISSION map
export const JOB_TYPE_PERMISSION: Record<JobType, string> = {
  ...
  your_new_job: 'jobs:create',  // or a specific permission
};

// Add to JOB_TYPE_CAPABILITY map
export const JOB_TYPE_CAPABILITY: Record<JobType, string> = {
  ...
  your_new_job: 'your_capability',  // capability the agent must report
};
```

### 2. Add Backend Route/Validation

The backend's job creation route (`src/routes/ui/jobs.routes.ts`) already handles all job types generically. The `job.service.ts` validates capability matching automatically.

If your job needs special server-side logic, add it to `src/services/job.service.ts`.

### 3. Add Agent Handler

**File:** `apps/agent/src/modules/runner.rs`

```rust
impl JobRunner {
    pub async fn execute(job: &JobRequest) -> JobResult {
        match job.job_type.as_str() {
            "your_new_job" => Self::your_new_job(job).await,
            // ...
        }
    }

    async fn your_new_job(job: &JobRequest) -> Result<JobResult> {
        let param1 = job.payload.get("param1")
            .and_then(|v| v.as_str())
            .context("Missing param1")?;

        // Your implementation here

        Ok(JobResult {
            job_id: job.job_id.clone(),
            status: "success".to_string(),
            // ...
        })
    }
}
```

### 4. Add Agent Capability

**File:** `apps/agent/src/config.rs`

Add `"your_capability"` to the default capabilities list.

### 5. Add Frontend UI (Optional)

If the job type needs a custom dialog or form, create it in `apps/frontend/src/components/`.

For simple jobs, the Run Script dialog or a generic job creation form can be used.

### 6. Test the Full Flow

1. Start backend + frontend + agent
2. Verify agent reports the new capability in heartbeat
3. Create a job via UI or API:
   ```bash
   curl -X POST http://localhost:4000/api/jobs \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "agent_id": "<agent-uuid>",
       "type": "your_new_job",
       "payload": { "param1": "value", "param2": 42 }
     }'
   ```
4. Verify agent picks up the job and reports result
5. Check the job result in the UI

## Checklist

- [ ] Job type added to `JobType` union in `shared/jobs.ts`
- [ ] Payload interface defined
- [ ] Permission mapped in `JOB_TYPE_PERMISSION`
- [ ] Capability mapped in `JOB_TYPE_CAPABILITY`
- [ ] Agent handler implemented in `runner.rs`
- [ ] Capability added to agent config defaults
- [ ] Frontend UI created (if needed)
- [ ] Tested end-to-end
- [ ] Audit log entries verified
