const RUNPOD_URL = `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/run`;
const STATUS_URL = (id: string) =>
  `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/status/${id}`;

// Single source of truth for the model name — also written to
// OverviewArticle.model in overview-service.ts so provenance stays accurate
// if this ever changes.
export const RUNPOD_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';

// Poll budget: kept comfortably under maxDuration=60 on both
// /api/overview/generate and /api/overview/process (24 * 2s = 48s, leaving
// ~12s headroom for submission + response handling).
const POLL_ATTEMPTS = 24;
const POLL_INTERVAL_MS = 2000;

async function submitJob(messages: { role: string; content: string }[]): Promise<string> {
  const attempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const submitRes = await fetch(RUNPOD_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            openai_route: '/v1/chat/completions',
            openai_input: {
              model: RUNPOD_MODEL,
              messages,
              temperature: 0.1,
              max_tokens: 1200,
            },
          },
          // Job-level policy (not endpoint-level): bounds a single worker's
          // execution time so it can't idle-run past this job, and lets a
          // queued-but-never-picked-up job expire instead of holding a slot.
          // Neither field changes `min workers` — that stays 0 from Step 1 —
          // this is purely about not letting one job overstay once it starts.
          policy: {
            executionTimeoutMs: 55_000, // stay under our own 60s route budget
            ttl: 60_000,                // drop the job if it's still queued after 60s
          },
        }),
      });

      if (!submitRes.ok) {
        throw new Error(`RunPod submission failed: ${submitRes.status} ${submitRes.statusText}`);
      }

      const submit = await submitRes.json();
      return submit.id;
    } catch (err) {
      lastError = err;
      console.error(`[runpod] submission attempt ${attempt}/${attempts} failed:`, err);
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// This function is the ONLY thing in the codebase that ever calls the RunPod
// endpoint. There are no health checks, keep-alive pings, or warm-up crons
// anywhere else — combined with `min workers = 0` (Step 1) and the async
// `/run` route (queue-based, not `/runsync`), the endpoint has zero standing
// traffic and scales all the way down to zero workers between invocations.
// It only ever spins up when a real cluster is being processed, and the
// `policy.executionTimeoutMs` below caps how long a worker can stay busy per
// job so it can't be left running (and billing) longer than one summary
// actually requires.
//
// Returns the extracted assistant message content as a plain string —
// callers don't need to know about RunPod's/vLLM's response shape.
export async function generateWithRunpod(messages: { role: string; content: string }[]): Promise<string> {
  const jobId = await submitJob(messages);

  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const statusRes = await fetch(STATUS_URL(jobId), {
      headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` },
    });

    if (!statusRes.ok) {
      console.error(`[runpod] status poll ${i} for job ${jobId} failed: ${statusRes.status} ${statusRes.statusText}`);
      continue;
    }

    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      const content = status.output?.choices?.[0]?.message?.content ?? status.output?.output;
      if (!content) {
        throw new Error(`RunPod job ${jobId} completed with no usable output content`);
      }
      return content;
    }
    if (status.status === 'FAILED') {
      throw new Error(`RunPod job ${jobId} failed: ${JSON.stringify(status.error)}`);
    }
  }
  throw new Error(`RunPod job ${jobId} timed out`);
}

