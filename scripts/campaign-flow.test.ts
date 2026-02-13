/**
 * Campaign Lifecycle Integration Test
 *
 * Tests the full campaign workflow as it would be triggered from the frontend:
 *   1. Seed a test lead
 *   2. Create campaign (→ DRAFT)
 *   3. Update campaign template & schedule
 *   4. Assign leads to the campaign
 *   5. Transition DRAFT → QUEUED
 *   6. Transition QUEUED → RUNNING
 *   7. Pause: RUNNING → PAUSED
 *   8. Resume: PAUSED → RUNNING
 *   9. Abort: RUNNING → PAUSED → ABORTED
 *  10. Delete the ABORTED campaign
 *  11. Verify deletion (GET returns 404)
 *
 * Prerequisites:
 *   - LocalStack running (docker-compose up)
 *   - SAM local API running on port 3001 (bun run scripts/dev-api.ts)
 *
 * Run:
 *   bun test scripts/campaign-flow.test.ts
 */

import { test, expect } from "bun:test";

// SAM local API uses Docker containers — cold starts can be slow
const TEST_TIMEOUT = 180_000; // 3 minutes per test

const API_URL = "http://localhost:3001";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api(method: string, path: string, body?: unknown, retries = 1): Promise<{ status: number; data: any }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      return { status: res.status, data: json };
    } catch (err: any) {
      if (err.name === "AbortError" && attempt < retries) {
        log("Retry", `${method} ${path} timed out, retrying (${attempt + 1}/${retries})...`);
        continue;
      }
      if (err.name === "AbortError") {
        return { status: 0, data: { message: `Request timed out: ${method} ${path}` } };
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return { status: 0, data: { message: "Unreachable" } };
}

/** Generate today + next 6 days as YYYY-MM-DD strings */
function nextSevenDates(): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function log(step: string, detail?: string) {
  const msg = detail ? `${step} — ${detail}` : step;
  console.log(`  ${msg}`);
}

// ---------------------------------------------------------------------------
// Campaign create payload (matches CampaignCreateInputSchema in Zod)
// ---------------------------------------------------------------------------

const scheduledDates = nextSevenDates();

const campaignPayload = {
  name: `Test Campaign ${Date.now()}`,
  description: "Automated lifecycle test",
  senderEmail: "noreply@pivotr.local",
  senderName: "Test Sender",
  template: {
    subject: "Hello {{firstName}}",
    body: "<p>Hi {{firstName}}, this is a test email from Pivotr.</p>",
  },
  leadSelection: {
    leadTypes: ["ALL"],
    leadStatuses: ["ALL"],
  },
  schedule: {
    workingHours: { start: "09:00", end: "18:00" },
    peakHours: { start: "10:00", end: "14:00" },
    timezone: "Asia/Kolkata",
    scheduledDates,
    dailyLimit: 100,
    batchSize: 10,
  },
  delayConfig: {
    minDelayMs: 30000,
    maxDelayMs: 120000,
  },
  sendCriteria: {
    allowCatchAll: false,
    allowUnknown: false,
    allowRisky: false,
  },
};

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

let campaignId: string;

test("Campaign Lifecycle: create → queue → run → pause → resume → abort → delete", async () => {
  // ── 0. Seed leads so we have something to assign ─────────────────────
  log("Step 0", "Seeding test leads...");
  const ts = Date.now();
  for (let i = 0; i < 5; i++) {
    const leadRes = await api("POST", "/leads", {
      fullName: `Test Lead ${ts}-${i}`,
      email: `test-${ts}-${i}@example.com`,
      companyName: "Test Corp",
      status: "VERIFIED",
      leadType: "SOFTWARE",
    });
    if (i === 0 && leadRes.status === 201) {
      log("Step 0", `Seeded lead ${leadRes.data.data?.id ?? "(no id)"} (+4 more)`);
    }
  }

  // ── 1. Create Campaign ─────────────────────────────────────────────────
  log("Step 1", "Creating campaign...");
  const createRes = await api("POST", "/campaigns", campaignPayload);

  if (createRes.status !== 201) {
    console.error("Create failed:", JSON.stringify(createRes.data, null, 2));
  }
  expect(createRes.status).toBe(201);
  expect(createRes.data.success).toBe(true);

  campaignId = createRes.data.data.id;
  expect(createRes.data.data.status).toBe("DRAFT");
  log("Step 1", `Created campaign ${campaignId} [DRAFT]`);

  // ── 2. Read campaign back ──────────────────────────────────────────────
  log("Step 2", "Fetching campaign...");
  const getRes = await api("GET", `/campaigns/${campaignId}`);
  expect(getRes.status).toBe(200);
  expect(getRes.data.data.id).toBe(campaignId);
  expect(getRes.data.data.status).toBe("DRAFT");
  log("Step 2", "GET confirmed DRAFT status");

  // ── 3. Update campaign (template tweak) ────────────────────────────────
  log("Step 3", "Updating template...");
  const updateRes = await api("PUT", `/campaigns/${campaignId}`, {
    template: {
      subject: "Updated: Hello {{firstName}}",
      body: "<p>Hi {{firstName}}, updated body for testing.</p>",
    },
  });
  expect(updateRes.status).toBe(200);
  log("Step 3", "Campaign updated");

  // ── 4. Assign leads ────────────────────────────────────────────────────
  log("Step 4", "Assigning leads...");
  const assignRes = await api("POST", `/campaigns/${campaignId}/assign-leads`, {
    leadTypes: ["ALL"],
    leadStatuses: ["ALL"],
    maxLeads: 5000,
  });
  if (assignRes.status !== 200) {
    console.error("Assign-leads failed:", JSON.stringify(assignRes.data, null, 2));
  }
  expect(assignRes.status).toBe(200);

  const assignedCount: number = assignRes.data.data?.assignedCount ?? 0;
  log("Step 4", `Assigned ${assignedCount} lead(s)`);

  if (assignedCount === 0) {
    log("Step 4", "WARNING: No leads available — lifecycle transitions that require leads will be skipped");
  }

  // ── 5. DRAFT → QUEUED ─────────────────────────────────────────────────
  log("Step 5", "Transitioning DRAFT → QUEUED...");
  const queueRes = await api("PUT", `/campaigns/${campaignId}/status`, {
    status: "QUEUED",
  });

  if (assignedCount === 0) {
    // Expect failure because campaign needs leads to queue
    expect(queueRes.status).toBe(400);
    log("Step 5", `Correctly rejected (no leads): ${queueRes.data.message}`);
    // Clean up the draft and exit early
    const delRes = await api("DELETE", `/campaigns/${campaignId}`);
    expect(delRes.status).toBe(200);
    log("Cleanup", "Deleted draft campaign (no leads to test full lifecycle)");
    return;
  }

  expect(queueRes.status).toBe(200);
  expect(queueRes.data.data.currentStatus).toBe("QUEUED");
  log("Step 5", "Campaign is QUEUED");

  // ── 6. QUEUED → RUNNING ───────────────────────────────────────────────
  log("Step 6", "Transitioning QUEUED → RUNNING...");
  const runRes = await api("PUT", `/campaigns/${campaignId}/status`, {
    status: "RUNNING",
  });
  expect(runRes.status).toBe(200);
  expect(runRes.data.data.currentStatus).toBe("RUNNING");
  log("Step 6", "Campaign is RUNNING");

  // ── 7. RUNNING → PAUSED ───────────────────────────────────────────────
  log("Step 7", "Pausing campaign...");
  const pauseRes = await api("PUT", `/campaigns/${campaignId}/status`, {
    status: "PAUSED",
  });
  expect(pauseRes.status).toBe(200);
  expect(pauseRes.data.data.currentStatus).toBe("PAUSED");
  log("Step 7", "Campaign is PAUSED");

  // Verify pausedAt is set
  const afterPause = await api("GET", `/campaigns/${campaignId}`);
  expect(afterPause.data.data.pausedAt).toBeTruthy();
  log("Step 7", `pausedAt = ${afterPause.data.data.pausedAt}`);

  // ── 8. PAUSED → RUNNING (resume) ─────────────────────────────────────
  log("Step 8", "Resuming campaign...");
  const resumeRes = await api("PUT", `/campaigns/${campaignId}/status`, {
    status: "RUNNING",
  });
  expect(resumeRes.status).toBe(200);
  expect(resumeRes.data.data.currentStatus).toBe("RUNNING");
  log("Step 8", "Campaign RESUMED (RUNNING)");

  // Verify pausedAt is cleared
  const afterResume = await api("GET", `/campaigns/${campaignId}`);
  expect(afterResume.data.data.pausedAt).toBeNull();
  log("Step 8", "pausedAt cleared after resume");

  // ── 9. Abort: RUNNING → PAUSED → ABORTED ─────────────────────────────
  // RUNNING cannot go directly to ABORTED (only to ABORTING).
  // The frontend path is: pause first, then abort from PAUSED.
  log("Step 9a", "Pausing before abort...");
  const pause2Res = await api("PUT", `/campaigns/${campaignId}/status`, {
    status: "PAUSED",
  });
  expect(pause2Res.status).toBe(200);
  expect(pause2Res.data.data.currentStatus).toBe("PAUSED");

  log("Step 9b", "Aborting campaign (PAUSED → ABORTED)...");
  const abortRes = await api("PUT", `/campaigns/${campaignId}/status`, {
    status: "ABORTED",
  });
  expect(abortRes.status).toBe(200);
  expect(abortRes.data.data.currentStatus).toBe("ABORTED");
  log("Step 9b", "Campaign is ABORTED");

  // ── 10. Delete the aborted campaign ───────────────────────────────────
  log("Step 10", "Deleting ABORTED campaign...");
  const deleteRes = await api("DELETE", `/campaigns/${campaignId}`);
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.data.success).toBe(true);
  log("Step 10", "Campaign deleted");

  // ── 11. Confirm deletion (should 404) ─────────────────────────────────
  log("Step 11", "Confirming deletion (expect 404)...");
  const gone = await api("GET", `/campaigns/${campaignId}`);
  expect(gone.status).toBe(404);
  log("Step 11", "Confirmed: campaign no longer exists");
}, TEST_TIMEOUT);

test("Campaign Delete: cannot delete a RUNNING campaign", async () => {
  // Create + assign + queue + run, then try to delete (should fail)
  log("Setup", "Creating campaign for delete-guard test...");
  const ts = Date.now();

  // Seed leads for this test
  for (let i = 0; i < 3; i++) {
    await api("POST", "/leads", {
      fullName: `Delete Test Lead ${ts}-${i}`,
      email: `delete-test-${ts}-${i}@example.com`,
      companyName: "Test Corp",
      status: "VERIFIED",
      leadType: "SOFTWARE",
    });
  }

  const createRes = await api("POST", "/campaigns", {
    ...campaignPayload,
    name: `Delete Guard Test ${ts}`,
  });
  expect(createRes.status).toBe(201);
  const id = createRes.data.data.id;

  // Assign leads
  const assignRes = await api("POST", `/campaigns/${id}/assign-leads`, {
    leadTypes: ["ALL"],
    leadStatuses: ["ALL"],
    maxLeads: 5000,
  });

  if ((assignRes.data.data?.assignedCount ?? 0) === 0) {
    log("Skip", "No leads — cleaning up and skipping delete-guard test");
    await api("DELETE", `/campaigns/${id}`);
    return;
  }

  // DRAFT → QUEUED → RUNNING
  await api("PUT", `/campaigns/${id}/status`, { status: "QUEUED" });
  const runRes = await api("PUT", `/campaigns/${id}/status`, { status: "RUNNING" });
  expect(runRes.status).toBe(200);

  // Try to delete while RUNNING (should fail)
  log("Test", "Attempting DELETE on RUNNING campaign...");
  const deleteRes = await api("DELETE", `/campaigns/${id}`);
  expect(deleteRes.status).toBe(400);
  expect(deleteRes.data.message).toContain("Cannot delete campaign in RUNNING status");
  log("Test", `Correctly rejected: ${deleteRes.data.message}`);

  // Cleanup: RUNNING → PAUSED → ABORTED → DELETE
  // SAM local API can be flaky with rapid sequential calls, so retry cleanup
  log("Cleanup", "RUNNING → PAUSED...");
  await api("PUT", `/campaigns/${id}/status`, { status: "PAUSED" });
  log("Cleanup", "PAUSED → ABORTED...");
  await api("PUT", `/campaigns/${id}/status`, { status: "ABORTED" });
  log("Cleanup", "Deleting...");
  let cleanupDel = await api("DELETE", `/campaigns/${id}`);
  if (cleanupDel.status !== 200) {
    log("Cleanup", `First delete attempt returned ${cleanupDel.status}, retrying...`);
    cleanupDel = await api("DELETE", `/campaigns/${id}`);
  }
  log("Cleanup", `Campaign cleanup result: ${cleanupDel.status}`);
}, TEST_TIMEOUT);

test("Campaign Status: invalid transitions are rejected", async () => {
  log("Setup", "Creating campaign for invalid-transition test...");
  const createRes = await api("POST", "/campaigns", {
    ...campaignPayload,
    name: `Invalid Transition Test ${Date.now()}`,
  });
  expect(createRes.status).toBe(201);
  const id = createRes.data.data.id;

  // DRAFT → RUNNING should fail (must go through QUEUED)
  log("Test", "DRAFT → RUNNING (should fail)...");
  const badRes = await api("PUT", `/campaigns/${id}/status`, { status: "RUNNING" });
  expect(badRes.status).toBe(400);
  expect(badRes.data.message).toContain("Invalid transition");
  log("Test", `Correctly rejected: ${badRes.data.message}`);

  // DRAFT → PAUSED should fail
  log("Test", "DRAFT → PAUSED (should fail)...");
  const badRes2 = await api("PUT", `/campaigns/${id}/status`, { status: "PAUSED" });
  expect(badRes2.status).toBe(400);
  log("Test", `Correctly rejected: ${badRes2.data.message}`);

  // DRAFT → COMPLETED should fail
  log("Test", "DRAFT → COMPLETED (should fail)...");
  const badRes3 = await api("PUT", `/campaigns/${id}/status`, { status: "COMPLETED" });
  expect(badRes3.status).toBe(400);
  log("Test", `Correctly rejected: ${badRes3.data.message}`);

  // Cleanup
  await api("DELETE", `/campaigns/${id}`);
  log("Cleanup", "Draft campaign deleted");
}, TEST_TIMEOUT);
