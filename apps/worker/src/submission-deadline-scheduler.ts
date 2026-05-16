import "dotenv/config";
import { runSubmissionDeadlineJob } from "../../api/src/submissions/submission-deadline-job.ts";

const intervalMinutesRaw = process.env.SUBMISSION_DEADLINE_JOB_INTERVAL_MINUTES ?? "5";
const intervalMinutes = Number(intervalMinutesRaw);
const intervalMs = Number.isFinite(intervalMinutes) && intervalMinutes > 0
  ? intervalMinutes * 60 * 1000
  : 5 * 60 * 1000;

async function runOnce(): Promise<void> {
  const result = await runSubmissionDeadlineJob();
  console.log(
    `[worker][submission-deadline] marked=${result.markedNotSubmitted} scannedStages=${result.scannedStages} scannedGroups=${result.scannedGroups} skippedExisting=${result.skippedExisting}`,
  );
}

async function bootstrap(): Promise<void> {
  console.log(`[worker][submission-deadline] scheduler started intervalMs=${intervalMs}`);
  await runOnce();
  setInterval(() => {
    runOnce().catch((err: unknown) => {
      console.error("[worker][submission-deadline] run failed", err);
    });
  }, intervalMs);
}

bootstrap().catch((err: unknown) => {
  console.error("[worker][submission-deadline] bootstrap failed", err);
  process.exit(1);
});
