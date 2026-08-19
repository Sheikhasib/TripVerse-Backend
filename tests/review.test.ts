import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { BookingStatus, Role } from "../generated/prisma/enums";
import {
  bearer,
  createAgent,
  createBooking,
  createPackage,
  createUser,
  loginAs,
} from "./factories";

const reviewPayload = (packageId: string, rating = 5) => ({
  packageId,
  rating,
  comment: "A solid trip from the test suite.",
});

// A COMPLETED booking is the gate for leaving a review — travel date in the past.
const completedBooking = (userId: string, packageId: string) =>
  createBooking({
    userId,
    packageId,
    status: BookingStatus.COMPLETED,
    travelDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  });

const packageRating = async (packageId: string) => {
  const pkg = await prisma.tourPackage.findUnique({ where: { id: packageId } });
  return Number(pkg?.rating ?? 0);
};

describe("review", () => {
  it("denies a review without a completed booking (403)", async () => {
    const user = await createUser();
    const tourPackage = await createPackage();
    const { accessToken } = await loginAs(user);

    const res = await request(app)
      .post("/api/reviews")
      .set(bearer(accessToken))
      .send(reviewPayload(tourPackage.id));

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/after completing a booking/i);
  });

  it("denies an agent reviewing their own package (403 via RBAC)", async () => {
    const agent = await createAgent();
    const tourPackage = await createPackage({ agentId: agent.id });
    const { accessToken } = await loginAs(agent);

    const res = await request(app)
      .post("/api/reviews")
      .set(bearer(accessToken))
      .send(reviewPayload(tourPackage.id));

    expect(res.status).toBe(403);
  });

  it("rejects a duplicate review for the same package with 409", async () => {
    const user = await createUser();
    const tourPackage = await createPackage();
    await completedBooking(user.id, tourPackage.id);
    const { accessToken } = await loginAs(user);

    const first = await request(app)
      .post("/api/reviews")
      .set(bearer(accessToken))
      .send(reviewPayload(tourPackage.id));
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post("/api/reviews")
      .set(bearer(accessToken))
      .send(reviewPayload(tourPackage.id));
    expect(dup.status).toBe(409);
  });

  it("recomputes the package average across reviewers (avg to 1dp)", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const tourPackage = await createPackage();
    await completedBooking(userA.id, tourPackage.id);
    await completedBooking(userB.id, tourPackage.id);

    const { accessToken: tokenA } = await loginAs(userA);
    const { accessToken: tokenB } = await loginAs(userB);

    const a = await request(app)
      .post("/api/reviews")
      .set(bearer(tokenA))
      .send(reviewPayload(tourPackage.id, 4));
    expect(a.status).toBe(201);
    expect(await packageRating(tourPackage.id)).toBe(4);

    const b = await request(app)
      .post("/api/reviews")
      .set(bearer(tokenB))
      .send(reviewPayload(tourPackage.id, 5));
    expect(b.status).toBe(201);
    expect(await packageRating(tourPackage.id)).toBe(4.5);
  });

  it("recomputes the average after an edit and a delete (deleted ratings excluded)", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const tourPackage = await createPackage();
    await completedBooking(userA.id, tourPackage.id);
    await completedBooking(userB.id, tourPackage.id);

    const { accessToken: tokenA } = await loginAs(userA);
    const { accessToken: tokenB } = await loginAs(userB);

    const ra = await request(app)
      .post("/api/reviews")
      .set(bearer(tokenA))
      .send(reviewPayload(tourPackage.id, 4));
    const rb = await request(app)
      .post("/api/reviews")
      .set(bearer(tokenB))
      .send(reviewPayload(tourPackage.id, 5));
    expect(await packageRating(tourPackage.id)).toBe(4.5);

    // userA edits 4 → 5 → average becomes 5
    const edited = await request(app)
      .patch(`/api/reviews/${ra.body.data.review.id}`)
      .set(bearer(tokenA))
      .send({ rating: 5 });
    expect(edited.status).toBe(200);
    expect(await packageRating(tourPackage.id)).toBe(5);

    // userB deletes theirs → only userA's 5 remains → average stays 5, and the
    // deleted review must not appear in the public list
    const removed = await request(app)
      .delete(`/api/reviews/${rb.body.data.review.id}`)
      .set(bearer(tokenB));
    expect(removed.status).toBe(200);
    expect(await packageRating(tourPackage.id)).toBe(5);

    const list = await request(app).get(`/api/reviews/package/${tourPackage.id}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });

  it("lets an ADMIN delete anyone's review", async () => {
    const user = await createUser();
    const admin = await createUser({ role: Role.ADMIN });
    const tourPackage = await createPackage();
    await completedBooking(user.id, tourPackage.id);

    const { accessToken: userToken } = await loginAs(user);
    const created = await request(app)
      .post("/api/reviews")
      .set(bearer(userToken))
      .send(reviewPayload(tourPackage.id));

    const { accessToken: adminToken } = await loginAs(admin);
    const res = await request(app)
      .delete(`/api/reviews/${created.body.data.review.id}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
  });
});