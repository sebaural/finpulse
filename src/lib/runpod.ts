const RUNPOD_URL = `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/run`;
const STATUS_URL = (id: string) =>
  `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/status/${id}`;

// This function is the ONLY thing in the codebase that ever calls the RunPod
// endpoint. There are no health checks, keep-alive pings, or warm-up crons
// anywhere else — combined with `min workers = 0` (Step 1) and the async
// `/run` route (queue-based, not `/runsync`), the endpoint has zero standing
// traffic and scales all the way down to zero workers between invocations.
// It only ever spins up when a real cluster is being processed, and the
// `policy.executionTimeoutMs` below caps how long a worker can stay busy per
// job so it can't be left running (and billing) longer than one summary
// actually requires.
export async function generateWithRunpod(messages: { role: string; content: string }[]) {
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
          model: 'meta-llama/Llama-3.1-8B-Instruct',
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
    throw new Error(`RunPod submission failed: ${submitRes.statusText}`);
  }

  const submit = await submitRes.json();
  const jobId = submit.id;

  // Poll for completion (max 60 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(STATUS_URL(jobId), {
      headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` },
    });

    if (!statusRes.ok) continue;

    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      return status.output;
    }
    if (status.status === 'FAILED') {
      throw new Error(`RunPod job ${jobId} failed: ${JSON.stringify(status.error)}`);
    }
  }
  throw new Error(`RunPod job ${jobId} timed out`);
}

