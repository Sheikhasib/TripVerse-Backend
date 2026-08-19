import request from "supertest";
import app from "../src/app";
import { BookingStatus, Role } from "../generated/prisma/enums";
import {
  bearer,
  createAgent,
  createBooking,
  createPackage,
  createUser,
  loginAs,
} from "./factories";

describe("dashboard", () => {
  it("is role-scoped: a USER cannot read the admin dashboard (403)", async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(user);

    const res = await request(app)
      .get("/api/dashboard/admin")
      .set(bearer(accessToken));
    expect(res.status).toBe(403);
  });

  it("admin dashboard deltas reflect a new COMPLETED booking", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const { accessToken } = await loginAs(admin);

    const before = await request(app)
      .get("/api/dashboard/admin")
      .set(bearer(accessToken));
    expect(before.status).toBe(200);

    // one fresh COMPLETED booking worth 5500
    await createBooking({
      status: BookingStatus.COMPLETED,
      totalPrice: 5500,
      travelDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });

    const after = await request(app)
      .get("/api/dashboard/admin")
      .set(bearer(accessToken));

    expect(after.body.data.totalBookings).toBe(
      before.body.data.totalBookings + 1,
    );
    expect(after.body.data.totalRevenue).toBe(
      before.body.data.totalRevenue + 5500,
    );
    const completed = after.body.data.bookingsByStatus.find(
      (b: { status: string }) => b.status === BookingStatus.COMPLETED,
    );
    expect(completed.count).toBeGreaterThanOrEqual(1);
  });

  it("agent dashboard is scoped to the agent's own packages only", async () => {
    const agent = await createAgent();
    const otherAgent = await createAgent();
    const { accessToken } = await loginAs(agent);

    // a package + completed booking on the agent's own package
    const ownPackage = await createPackage({ agentId: agent.id });
    await createBooking({
      userId: (await createUser()).id,
      packageId: ownPackage.id,
      status: BookingStatus.COMPLETED,
      totalPrice: 7000,
      travelDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    // another agent's package must NOT leak into this dashboard
    await createPackage({ agentId: otherAgent.id });

    const res = await request(app)
      .get("/api/dashboard/agent")
      .set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.totalPackages).toBe(1);
    expect(res.body.data.totalBookings).toBe(1);
    expect(res.body.data.totalRevenue).toBe(7000);
  });

  it("user dashboard is scoped to the user's own bookings", async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(user);

    // completed (counts toward spend) + upcoming (counts toward upcoming)
    await createBooking({
      userId: user.id,
      status: BookingStatus.COMPLETED,
      totalPrice: 3000,
      travelDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });
    await createBooking({
      userId: user.id,
      status: BookingStatus.PENDING,
      totalPrice: 2000,
      travelDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get("/api/dashboard/user")
      .set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.totalBookings).toBe(2);
    expect(res.body.data.totalSpend).toBe(3000);
    expect(res.body.data.upcomingCount).toBe(1);
  });
});