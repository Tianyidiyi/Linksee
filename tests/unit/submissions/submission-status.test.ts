import { describe, expect, it } from "@jest/globals";
import {
  canCreateSubmissionAttempt,
  canTransitionSubmissionStatus,
  reviewDecisionToSubmissionStatus,
} from "../../../apps/api/src/submissions/submission-status.js";

const SubmissionStatus = {
  draft: "draft",
  not_submitted: "not_submitted",
  submitted: "submitted",
  under_review: "under_review",
  needs_changes: "needs_changes",
  reviewed: "reviewed",
  approved: "approved",
  rejected: "rejected",
} as const;

const ReviewDecision = {
  approved: "approved",
  needs_changes: "needs_changes",
  rejected: "rejected",
} as const;

describe("submissions/submission-status", () => {
  it("canCreateSubmissionAttempt should reject finalized statuses", () => {
    expect(canCreateSubmissionAttempt(SubmissionStatus.approved)).toEqual({
      ok: false,
      message: "Submission has already been finalized and cannot be resubmitted",
    });
    expect(canCreateSubmissionAttempt(SubmissionStatus.rejected)).toEqual({
      ok: false,
      message: "Submission has already been finalized and cannot be resubmitted",
    });
    expect(canCreateSubmissionAttempt(SubmissionStatus.reviewed)).toEqual({
      ok: false,
      message: "Submission has already been finalized and cannot be resubmitted",
    });
  });

  it("canCreateSubmissionAttempt should reject not_submitted and pending review statuses", () => {
    expect(canCreateSubmissionAttempt(SubmissionStatus.not_submitted)).toEqual({
      ok: false,
      message: "Stage deadline has passed; contact course staff for offline handling",
    });
    expect(canCreateSubmissionAttempt(SubmissionStatus.submitted)).toEqual({
      ok: false,
      message: "Submission is pending review",
    });
    expect(canCreateSubmissionAttempt(SubmissionStatus.under_review)).toEqual({
      ok: false,
      message: "Submission is pending review",
    });
  });

  it("canCreateSubmissionAttempt should allow draft/needs_changes", () => {
    expect(canCreateSubmissionAttempt(SubmissionStatus.draft)).toEqual({ ok: true });
    expect(canCreateSubmissionAttempt(SubmissionStatus.needs_changes)).toEqual({ ok: true });
  });

  it("reviewDecisionToSubmissionStatus should map decisions", () => {
    expect(reviewDecisionToSubmissionStatus(ReviewDecision.approved)).toBe(SubmissionStatus.approved);
    expect(reviewDecisionToSubmissionStatus(ReviewDecision.needs_changes)).toBe(SubmissionStatus.needs_changes);
    expect(reviewDecisionToSubmissionStatus(ReviewDecision.rejected)).toBe(SubmissionStatus.rejected);
  });

  it("canTransitionSubmissionStatus should allow designed transitions", () => {
    expect(canTransitionSubmissionStatus(SubmissionStatus.submitted, SubmissionStatus.under_review)).toBe(true);
    expect(canTransitionSubmissionStatus(SubmissionStatus.submitted, SubmissionStatus.approved)).toBe(true);
    expect(canTransitionSubmissionStatus(SubmissionStatus.under_review, SubmissionStatus.needs_changes)).toBe(true);
    expect(canTransitionSubmissionStatus(SubmissionStatus.under_review, SubmissionStatus.rejected)).toBe(true);
    expect(canTransitionSubmissionStatus(SubmissionStatus.not_submitted, SubmissionStatus.reviewed)).toBe(true);
    expect(canTransitionSubmissionStatus(SubmissionStatus.approved, SubmissionStatus.approved)).toBe(true);
  });

  it("canTransitionSubmissionStatus should reject invalid transitions", () => {
    expect(canTransitionSubmissionStatus(SubmissionStatus.draft, SubmissionStatus.under_review)).toBe(false);
    expect(canTransitionSubmissionStatus(SubmissionStatus.reviewed, SubmissionStatus.approved)).toBe(false);
    expect(canTransitionSubmissionStatus(SubmissionStatus.not_submitted, SubmissionStatus.approved)).toBe(false);
    expect(canTransitionSubmissionStatus(SubmissionStatus.approved, SubmissionStatus.rejected)).toBe(false);
  });
});
