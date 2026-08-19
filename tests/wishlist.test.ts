import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { PackageStatus } from "../generated/prisma/enums";
import {
  bearer,
  createPackage,
  createUser,
  loginAs,
} from "./factories";

describe("wishlist", () => {
  it("adds a package and lists it", async () => {
    const user = await createUser();
    const tourPackage = await createPackage();
    const { accessToken } = await loginAs(user);

    const add = await request(app)
      .post("/api/wishlist")
      .set(bearer(accessToken))
      .send({ packageId: tourPackage.id });
    expect(add.status).toBe(201);

    const list = await request(app)
      .get("/api/wishlist")
      .set(bearer(accessToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].package.id).toBe(tourPackage.id);
  });

  it("adding twice is idempotent — one row only", async () => {
    const user = await createUser();
    const tourPackage = await createPackage();
    const { accessToken } = await loginAs(user);

    await request(app).post("/api/wishlist").set(bearer(accessToken)).send({ packageId: tourPackage.id });
    await request(app).post("/api/wishlist").set(bearer(accessToken)).send({ packageId: tourPackage.id });

    const count = await prisma.wishlistItem.count({
      where: { userId: user.id, packageId: tourPackage.id },
    });
    expect(count).toBe(1);
  });

  it("removes a package idempotently", async () => {
    const user = await createUser();
    const tourPackage = await createPackage();
    const { accessToken } = await loginAs(user);

    await request(app).post("/api/wishlist").set(bearer(accessToken)).send({ packageId: tourPackage.id });

    const del = await request(app)
      .delete(`/api/wishlist/${tourPackage.id}`)
      .set(bearer(accessToken));
    expect(del.status).toBe(204);

    // deleting again is a no-op, not an error
    const again = await request(app)
      .delete(`/api/wishlist/${tourPackage.id}`)
      .set(bearer(accessToken));
    expect(again.status).toBe(204);

    const count = await prisma.wishlistItem.count({
      where: { userId: user.id, packageId: tourPackage.id },
    });
    expect(count).toBe(0);
  });

  it("rejects saving a package that is not APPROVED (404)", async () => {
    const user = await createUser();
    const tourPackage = await createPackage({ status: PackageStatus.PENDING });
    const { accessToken } = await loginAs(user);

    const res = await request(app)
      .post("/api/wishlist")
      .set(bearer(accessToken))
      .send({ packageId: tourPackage.id });

    expect(res.status).toBe(404);
  });
});