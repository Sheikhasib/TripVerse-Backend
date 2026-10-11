import request from "supertest";
import app from "../src/app";
import { PackageStatus } from "../generated/prisma/enums";
import { bearer, createAgent, createPackage, loginAs } from "./factories";

describe("package", () => {
  it("my-packages honours the status filter", async () => {
    const agent = await createAgent();
    const pending = await createPackage({ agentId: agent.id, status: PackageStatus.PENDING });
    const approved = await createPackage({ agentId: agent.id, status: PackageStatus.APPROVED });
    const { accessToken } = await loginAs(agent);

    const onlyPending = await request(app)
      .get("/api/packages/internal/my-packages?status=PENDING")
      .set(bearer(accessToken));
    expect(onlyPending.status).toBe(200);
    expect(onlyPending.body.data.map((p: { id: string }) => p.id)).toEqual([pending.id]);
    expect(onlyPending.body.meta.total).toBe(1);

    const all = await request(app)
      .get("/api/packages/internal/my-packages")
      .set(bearer(accessToken));
    expect(all.body.data.map((p: { id: string }) => p.id).sort()).toEqual(
      [pending.id, approved.id].sort(),
    );
  });
});
