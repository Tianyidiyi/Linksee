import { expect, test } from "@playwright/test";

const roles = [
  {
    name: "student",
    dashboardPath: "/app/student-dashboard.html",
    userId: "2023010001",
    password: "ChangeMe123!",
    expectsTodo: true,
  },
  {
    name: "teacher",
    dashboardPath: "/app/teacher-dashboard.html",
    userId: "2023000001",
    password: "ChangeMe123!",
    expectsTodo: false,
  },
  {
    name: "assistant",
    dashboardPath: "/app/assistant-dashboard.html",
    userId: "2023019001",
    password: "ChangeMe123!",
    expectsTodo: false,
  },
  {
    name: "academic",
    dashboardPath: "/app/academic-dashboard.html",
    userId: "2022000001",
    password: "ChangeMe123!",
    expectsTodo: false,
  },
];

async function seedSession(page, request, role) {
  const response = await request.post("/api/v1/auth/login", {
    data: {
      userId: role.userId,
      password: role.password,
    },
  });

  expect(response.ok(), `login for ${role.name} should succeed`).toBeTruthy();

  const payload = await response.json();
  const session = payload?.data ?? {};

  await page.goto("/app/login.html", { waitUntil: "domcontentloaded" });
  await page.evaluate((nextSession) => {
    localStorage.setItem("auth_access_token", nextSession.accessToken || "");
    localStorage.setItem("auth_refresh_token", nextSession.refreshToken || "");
    localStorage.setItem("auth_user_id", nextSession.user?.id || "");
    localStorage.setItem("auth_role", nextSession.user?.role || "");
    localStorage.setItem("auth_real_name", nextSession.user?.realName || "");
    localStorage.setItem("auth_bio", nextSession.user?.bio || "");
    localStorage.setItem("auth_avatar_url", nextSession.user?.avatarUrl || "");
    localStorage.setItem("auth_force_change_password", nextSession.forceChangePassword ? "true" : "false");
    localStorage.setItem("auth_origin", window.location.origin);
  }, session);
}

async function getRect(locator) {
  const handle = await locator.elementHandle();
  if (!handle) {
    return null;
  }
  return handle.boundingBox();
}

function expectVisibleInsideViewport(rect, viewportWidth, viewportHeight, label) {
  expect(rect, `${label} should have a bounding box`).toBeTruthy();
  expect(rect.x, `${label} left edge should be visible`).toBeGreaterThanOrEqual(0);
  expect(rect.y, `${label} top edge should be visible`).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width, `${label} right edge should be visible`).toBeLessThanOrEqual(viewportWidth);
  expect(rect.y + rect.height, `${label} bottom edge should be visible`).toBeLessThanOrEqual(viewportHeight);
}

for (const role of roles) {
  test(`${role.name} dashboard topbar keeps actions visible and hero below header`, async ({ page, request }) => {
    await seedSession(page, request, role);
    await page.goto(role.dashboardPath, { waitUntil: "networkidle" });

    const topbar = page.locator(".dashboard-topbar");
    const chatButton = page.locator(".dashboard-topbar [data-chat-launcher]");
    const avatar = page.locator(".dashboard-topbar .topbar-avatar-wrapper");
    const todoButton = page.locator(".dashboard-topbar .student-todo-launcher");
    const activeTitle = page.locator(".page-panel.is-active .card-title").first();

    await expect(topbar).toBeVisible();
    await expect(chatButton).toBeVisible();
    await expect(avatar).toBeVisible();
    await expect(activeTitle).toBeVisible();

    if (role.expectsTodo) {
      await expect(todoButton).toBeVisible();
    } else {
      await expect(todoButton).toHaveCount(0);
    }

    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    const [topbarRect, chatRect, avatarRect, todoRect, titleRect] = await Promise.all([
      getRect(topbar),
      getRect(chatButton),
      getRect(avatar),
      role.expectsTodo ? getRect(todoButton) : Promise.resolve(null),
      getRect(activeTitle),
    ]);

    expect(topbarRect).toBeTruthy();
    expect(topbarRect.width).toBeLessThanOrEqual(viewport.width);
    expect(topbarRect.x).toBeGreaterThanOrEqual(0);
    expect(topbarRect.x + topbarRect.width).toBeLessThanOrEqual(viewport.width);

    expectVisibleInsideViewport(chatRect, viewport.width, viewport.height, `${role.name} chat button`);
    expectVisibleInsideViewport(avatarRect, viewport.width, viewport.height, `${role.name} avatar`);

    if (role.expectsTodo) {
      expectVisibleInsideViewport(todoRect, viewport.width, viewport.height, `${role.name} todo button`);
      expect(todoRect.x).toBeGreaterThan(chatRect.x);
      expect(avatarRect.x).toBeGreaterThan(todoRect.x);
    } else {
      expect(avatarRect.x).toBeGreaterThan(chatRect.x);
    }

    expect(titleRect.y).toBeGreaterThanOrEqual(topbarRect.y + topbarRect.height - 1);

    const hasHorizontalOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBeFalsy();
  });
}
