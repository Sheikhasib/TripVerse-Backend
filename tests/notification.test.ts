import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { randomUUID } from "node:crypto";
import {
  bearer,
  createNotification,
  createUser,
  loginAs,
} from "./factories";

describe("notification", () => {
  it("lists my notifications and reports the unread count", async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(user);
    await createNotification(user.id, { isRead: false });
    await createNotification(user.id, { isRead: true });

    const list = await request(app)
      .get("/api/notifications")
      .set(bearer(accessToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(2);

    const unread = await request(app)
      .get("/api/notifications/unread-count")
      .set(bearer(accessToken));
    expect(unread.status).toBe(200);
    expect(unread.body.data.count).toBe(1);

    // ?unread=true filters to unread only
    const onlyUnread = await request(app)
      .get("/api/notifications?unread=true")
      .set(bearer(accessToken));
    expect(onlyUnread.body.meta.total).toBe(1);
  });

  it("marks one notification read (owner only)", async () => {
    const user = await createUser();
    const other = await createUser();
    const { accessToken } = await loginAs(user);
    const notification = await createNotification(user.id, { isRead: false });

    // a foreign user cannot read it — uniform 404
    const { accessToken: otherToken } = await loginAs(other);
    const foreign = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set(bearer(otherToken));
    expect(foreign.status).toBe(404);

    const mine = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set(bearer(accessToken));
    expect(mine.status).toBe(200);

    const row = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(row?.isRead).toBe(true);
  });

  it("marks all notifications read, idempotently", async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(user);
    await createNotification(user.id, { isRead: false });
    await createNotification(user.id, { isRead: false });

    const first = await request(app)
      .patch("/api/notifications/read-all")
      .set(bearer(accessToken));
    expect(first.status).toBe(200);
    expect(first.body.data.count).toBe(2);

    const second = await request(app)
      .patch("/api/notifications/read-all")
      .set(bearer(accessToken));
    expect(second.body.data.count).toBe(0);

    const unread = await request(app)
      .get("/api/notifications/unread-count")
      .set(bearer(accessToken));
    expect(unread.body.data.count).toBe(0);
  });

  it("404s on a nonexistent notification id", async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(user);

    const res = await request(app)
      .patch(`/api/notifications/${randomUUID()}/read`)
      .set(bearer(accessToken));
    expect(res.status).toBe(404);
  });
});