import { cleanupArchivedCourseMaterials } from "../../api/src/assignments/course-material-cleanup.ts";

const intervalMinutesRaw = process.env.COURSE_MATERIAL_CLEANUP_INTERVAL_MINUTES ?? "1440";
const intervalMinutes = Number(intervalMinutesRaw);
const intervalMs = Number.isFinite(intervalMinutes) && intervalMinutes > 0
  ? intervalMinutes * 60 * 1000
  : 1440 * 60 * 1000;

async function runOnce(): Promise<void> {
  const result = await cleanupArchivedCourseMaterials();
  console.log(
    `[worker][course-material-cleanup] files=${result.files} assignments=${result.assignments} stages=${result.stages}`,
  );
}

async function bootstrap(): Promise<void> {
  console.log(`[worker][course-material-cleanup] scheduler started intervalMs=${intervalMs}`);
  await runOnce();
  setInterval(() => {
    runOnce().catch((err: unknown) => {
      console.error("[worker][course-material-cleanup] run failed", err);
    });
  }, intervalMs);
}

bootstrap().catch((err: unknown) => {
  console.error("[worker][course-material-cleanup] bootstrap failed", err);
  process.exit(1);
});
