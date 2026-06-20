import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../../apps/api/src/infra/prisma.js";
import { cleanupArchivedCourseMaterials } from "../../../apps/api/src/assignments/course-material-cleanup.js";
import * as materialStorage from "../../../apps/api/src/assignments/course-material-storage.js";
import * as assignmentNotifications from "../../../apps/api/src/assignments/assignment-notifications.js";

const AssignmentStatus = {
  draft: "draft",
  active: "active",
  archived: "archived",
} as const;

const StageStatus = {
  planned: "planned",
  open: "open",
  closed: "closed",
  archived: "archived",
} as const;

function material(name: string, objectKey: string) {
  return {
    name,
    objectKey,
    size: 1024,
    mimeType: "application/pdf",
    uploadedAt: "2026-05-01T00:00:00.000Z",
  };
}

describe("assignments/course-material-cleanup", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("should clear archived assignment and stage material references after retention window", async () => {
    const now = new Date("2026-06-19T00:00:00.000Z");
    jest.spyOn(prisma.assignment, "findMany").mockResolvedValue([
      {
        id: 11n,
        courseId: 21n,
        title: "Project",
        status: AssignmentStatus.archived,
        descriptionFiles: [material("spec.pdf", "courses/21/assignments/11/spec.pdf")],
        updatedAt: new Date("2026-05-10T00:00:00.000Z"),
      },
    ] as any);
    jest.spyOn(prisma.assignmentStage, "findMany").mockResolvedValue([
      {
        id: 31n,
        stageNo: 1,
        title: "Stage",
        status: StageStatus.closed,
        requirementFiles: [material("stage.pdf", "courses/21/assignments/11/stages/31/stage.pdf")],
        updatedAt: new Date("2026-05-11T00:00:00.000Z"),
        assignment: {
          courseId: 21n,
          status: AssignmentStatus.archived,
          updatedAt: new Date("2026-05-10T00:00:00.000Z"),
        },
      },
    ] as any);
    const assignmentUpdateSpy = jest.spyOn(prisma.assignment, "update").mockResolvedValue({} as any);
    const stageUpdateSpy = jest.spyOn(prisma.assignmentStage, "update").mockResolvedValue({} as any);
    jest.spyOn(prisma, "$transaction").mockImplementation(async (items: any) => Promise.all(items) as any);
    const removeSpy = jest.spyOn(materialStorage, "removeCourseMaterialObject").mockResolvedValue();
    const notifySpy = jest.spyOn(assignmentNotifications, "publishCourseSystemAnnouncement").mockResolvedValue();

    const result = await cleanupArchivedCourseMaterials({ now, retentionDays: 30, senderId: "2099000001" });

    expect(result).toMatchObject({ assignments: 1, stages: 1, files: 2 });
    expect(assignmentUpdateSpy).toHaveBeenCalledWith({
      where: { id: 11n },
      data: { descriptionFiles: [] },
    });
    expect(stageUpdateSpy).toHaveBeenCalledWith({
      where: { id: 31n },
      data: { requirementFiles: [] },
    });
    expect(removeSpy).toHaveBeenCalledTimes(2);
    expect(notifySpy).toHaveBeenCalledWith({
      courseId: 21n,
      senderId: "2099000001",
      content: expect.stringContaining("已清理归档课程材料 2 个"),
    });
  });

  it("should keep archived materials inside the retention window", async () => {
    const now = new Date("2026-06-19T00:00:00.000Z");
    jest.spyOn(prisma.assignment, "findMany").mockResolvedValue([
      {
        id: 11n,
        courseId: 21n,
        title: "Project",
        status: AssignmentStatus.archived,
        descriptionFiles: [material("spec.pdf", "courses/21/assignments/11/spec.pdf")],
        updatedAt: new Date("2026-06-18T00:00:00.000Z"),
      },
    ] as any);
    jest.spyOn(prisma.assignmentStage, "findMany").mockResolvedValue([] as any);
    const assignmentUpdateSpy = jest.spyOn(prisma.assignment, "update");
    const removeSpy = jest.spyOn(materialStorage, "removeCourseMaterialObject");

    const result = await cleanupArchivedCourseMaterials({ now, retentionDays: 30 });

    expect(result).toMatchObject({ assignments: 0, stages: 0, files: 0 });
    expect(assignmentUpdateSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("should use a 180 day default retention window", async () => {
    const previous = process.env.COURSE_MATERIAL_RETENTION_DAYS;
    delete process.env.COURSE_MATERIAL_RETENTION_DAYS;
    const now = new Date("2026-06-19T00:00:00.000Z");
    jest.spyOn(prisma.assignment, "findMany").mockResolvedValue([
      {
        id: 11n,
        courseId: 21n,
        title: "Project",
        status: AssignmentStatus.archived,
        descriptionFiles: [material("spec.pdf", "courses/21/assignments/11/spec.pdf")],
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ] as any);
    jest.spyOn(prisma.assignmentStage, "findMany").mockResolvedValue([] as any);
    const assignmentUpdateSpy = jest.spyOn(prisma.assignment, "update");

    try {
      const result = await cleanupArchivedCourseMaterials({ now, dryRun: true });
      expect(result).toMatchObject({ assignments: 0, stages: 0, files: 0 });
      expect(assignmentUpdateSpy).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.COURSE_MATERIAL_RETENTION_DAYS;
      else process.env.COURSE_MATERIAL_RETENTION_DAYS = previous;
    }
  });
});
