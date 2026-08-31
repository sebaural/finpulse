const RUNPOD_URL = `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/run`;
const STATUS_URL = (id: string) =>
  `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/status/${id}`;

// Single source of truth for the model name — also written to
// OverviewBlock.model in overview-service.ts so provenance stays accurate
// if this ever changes.
export const RUNPOD_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';

// Poll budget: kept comfortably under maxDuration=300 on /api/overview/process
// (4m20s of polling, leaving ~40s headroom for submission retries, response
// handling, and the DB write in processCluster). RunPod cold starts (min
// workers=0, see note below) can take 60-180s, so the old 48s budget was
// timing out client-side on otherwise-healthy jobs.
const POLL_MAX_WAIT_MS = 4.5 * 60 * 1000 - 10_000; // 4m20s
const POLL_INTERVAL_START_MS = 2000;
const POLL_INTERVAL_MAX_MS = 10_000;
const POLL_INTERVAL_BACKOFF = 1.4;
// A run of consecutive poll failures (network blip, transient 5xx) shouldn't
// burn the whole budget silently, but one-off errors shouldn't kill the job
// either — bail out only once they stop looking transient.
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

// RunPod's own job policy, sent at submission time. `ttl` is a hard wall-clock
// limit measured from SUBMISSION, not from when a worker picks the job up —
// it includes time spent queued waiting for a cold worker. Once it expires,
// RunPod deletes the job outright, and status polls for it return 404. Cold
// starts here (min workers=0) routinely take 60-180s, so ttl has to clear
// that plus generation time and stay aligned with POLL_MAX_WAIT_MS above —
// otherwise the client keeps polling a job RunPod already discarded. (This is
// what caused the "5x 404 in a row" incident: ttl was still 60_000, a
// leftover from the old 48s poll budget, so RunPod was killing jobs mid
// cold-start.) executionTimeoutMs is separate — it only bounds time once a
// worker actually starts running, so it can stay well under the ttl.
const JOB_TTL_MS = POLL_MAX_WAIT_MS - 5_000;
const JOB_EXECUTION_TIMEOUT_MS = 90_000;

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
          // See JOB_TTL_MS/JOB_EXECUTION_TIMEOUT_MS above for why these must
          // stay aligned with the poll budget rather than a fixed guess.
          policy: {
            executionTimeoutMs: JOB_EXECUTION_TIMEOUT_MS,
            ttl: JOB_TTL_MS,
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

  const deadline = Date.now() + POLL_MAX_WAIT_MS;
  let interval = POLL_INTERVAL_START_MS;
  let consecutiveFailures = 0;
  let pollNum = 0;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(POLL_INTERVAL_MAX_MS, Math.round(interval * POLL_INTERVAL_BACKOFF));
    pollNum++;

    const statusRes = await fetch(STATUS_URL(jobId), {
      headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` },
    }).catch((err) => {
      console.error(`[runpod] status poll ${pollNum} for job ${jobId} network error:`, err);
      return null;
    });

    if (!statusRes || !statusRes.ok) {
      const detail = statusRes ? `${statusRes.status} ${statusRes.statusText}` : 'network error';
      consecutiveFailures++;
      console.error(`[runpod] status poll ${pollNum} for job ${jobId} failed (${consecutiveFailures}/${MAX_CONSECUTIVE_POLL_FAILURES}): ${detail}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new Error(`RunPod status polling for job ${jobId} failed ${consecutiveFailures} times in a row (last: ${detail})`);
      }
      continue;
    }
    consecutiveFailures = 0;

    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      // RunPod's openai_route responses are usually a single ChatCompletion
      // object, but some worker-vllm versions wrap it in a one-element array
      // — handle both rather than assuming.
      const out = Array.isArray(status.output) ? status.output[0] : status.output;
      const content = out?.choices?.[0]?.message?.content ?? out?.output;
      if (!content) {
        // Shape/content unknown at this point (empty string, worker-level
        // error dict, finish_reason='length' with nothing generated, etc.) —
        // dump the raw output into the error itself so the next occurrence
        // is diagnosable from Vercel logs alone, without needing RunPod
        // dashboard access.
        const raw = JSON.stringify(status.output ?? null).slice(0, 500);
        throw new Error(`RunPod job ${jobId} completed with no usable output content: ${raw}`);
      }
      return content;
    }
    if (status.status === 'FAILED') {
      throw new Error(`RunPod job ${jobId} failed: ${JSON.stringify(status.error)}`);
    }
  }
  throw new Error(`RunPod job ${jobId} timed out after ${POLL_MAX_WAIT_MS}ms`);
}

