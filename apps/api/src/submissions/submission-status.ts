import { ReviewDecision, SubmissionStatus } from "@prisma/client";

export function canCreateSubmissionAttempt(status: SubmissionStatus): { ok: true } | { ok: false; message: string } {
  if (status === SubmissionStatus.approved || status === SubmissionStatus.rejected || status === SubmissionStatus.reviewed) {
    return { ok: false, message: "Submission has already been finalized and cannot be resubmitted" };
  }
  if (status === SubmissionStatus.not_submitted) {
    return { ok: false, message: "Stage deadline has passed; contact course staff for offline handling" };
  }
  if (status === SubmissionStatus.submitted || status === SubmissionStatus.under_review) {
    return { ok: false, message: "Submission is pending review" };
  }
  return { ok: true };
}

export function reviewDecisionToSubmissionStatus(decision: ReviewDecision): SubmissionStatus {
  if (decision === ReviewDecision.needs_changes) return SubmissionStatus.needs_changes;
  if (decision === ReviewDecision.approved) return SubmissionStatus.approved;
  return SubmissionStatus.rejected;
}

export function canTransitionSubmissionStatus(from: SubmissionStatus, to: SubmissionStatus): boolean {
  if (from === to) return true;
  if (from === SubmissionStatus.submitted && to === SubmissionStatus.under_review) return true;
  if (from === SubmissionStatus.submitted || from === SubmissionStatus.under_review) {
    return (
      to === SubmissionStatus.approved ||
      to === SubmissionStatus.needs_changes ||
      to === SubmissionStatus.rejected
    );
  }
  if (from === SubmissionStatus.not_submitted && to === SubmissionStatus.reviewed) return true;
  return false;
}
