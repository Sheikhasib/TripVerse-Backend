import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { PostStatus } from "../generated/prisma/enums";
import {
  bearer,
  createAdmin,
  createAgent,
  createComment,
  createPost,
  createUser,
  loginAs,
} from "./factories";

const postPayload = {
  title: "Ten best beaches in Bangladesh",
  excerpt: "A curated shortlist.",
  content: "Full article body about the beaches.",
  coverImage: "https://example.com/cover.jpg",
};

describe("blog", () => {
  it("creates a post as DRAFT and keeps it out of the public feed", async () => {
    const agent = await createAgent();
    const { accessToken } = await loginAs(agent);

    const created = await request(app)
      .post("/api/blog")
      .set(bearer(accessToken))
      .send(postPayload);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe(PostStatus.DRAFT);

    // a DRAFT never appears on the public feed or the public slug route (the
    // feed also contains the app's real published posts — assert by slug only)
    const hidden = await request(app).get(`/api/blog/${created.body.data.slug}`);
    expect(hidden.status).toBe(404);
  });

  it("publishes a post as ADMIN (agent edits reset it back to DRAFT)", async () => {
    const agent = await createAgent();
    const admin = await createAdmin();
    const { accessToken: agentToken } = await loginAs(agent);
    const { accessToken: adminToken } = await loginAs(admin);

    const created = await request(app)
      .post("/api/blog")
      .set(bearer(agentToken))
      .send(postPayload);

    const published = await request(app)
      .patch(`/api/blog/${created.body.data.id}/status`)
      .set(bearer(adminToken))
      .send({ status: PostStatus.PUBLISHED });
    expect(published.status).toBe(200);

    // now visible on the public slug route (assert by slug — the feed also
    // contains the app's real published posts)
    const visible = await request(app).get(`/api/blog/${created.body.data.slug}`);
    expect(visible.status).toBe(200);
    expect(visible.body.data.status).toBe(PostStatus.PUBLISHED);

    // agent edits own post → status resets to DRAFT (must be republished)
    const edited = await request(app)
      .patch(`/api/blog/${created.body.data.id}`)
      .set(bearer(agentToken))
      .send({ excerpt: "An updated shortlist." });
    expect(edited.status).toBe(200);
    expect(edited.body.data.status).toBe(PostStatus.DRAFT);

    // ...and it drops back out of the public feed
    const hidden = await request(app).get(`/api/blog/${created.body.data.slug}`);
    expect(hidden.status).toBe(404);
  });

  it("forbids an agent editing another agent's post (403)", async () => {
    const author = await createAgent();
    const intruder = await createAgent();
    const post = await createPost(author.id);

    const { accessToken } = await loginAs(intruder);
    const res = await request(app)
      .patch(`/api/blog/${post.id}`)
      .set(bearer(accessToken))
      .send({ excerpt: "Hijacked." });

    expect(res.status).toBe(403);
  });

  it("hides a DRAFT post from the public slug route (404)", async () => {
    const agent = await createAgent();
    const post = await createPost(agent.id, { status: PostStatus.DRAFT });

    const res = await request(app).get(`/api/blog/${post.slug}`);
    expect(res.status).toBe(404);
  });

  describe("comments", () => {
    it("creates a comment on a published post and rejects replies to replies", async () => {
      const agent = await createAgent();
      const user = await createUser();
      const post = await createPost(agent.id, { status: PostStatus.PUBLISHED });
      const { accessToken } = await loginAs(user);

      const created = await request(app)
        .post(`/api/blog/${post.slug}/comments`)
        .set(bearer(accessToken))
        .send({ content: "Great write-up!" });
      expect(created.status).toBe(201);

      const reply = await request(app)
        .post(`/api/blog/${post.slug}/comments`)
        .set(bearer(accessToken))
        .send({ content: "I agree.", parentId: created.body.data.id });
      expect(reply.status).toBe(201);

      const nested = await request(app)
        .post(`/api/blog/${post.slug}/comments`)
        .set(bearer(accessToken))
        .send({ content: "Nested?", parentId: reply.body.data.id });
      expect(nested.status).toBe(400);
      expect(nested.body.message).toMatch(/replies to replies/i);
    });

    it("blocks comments on a DRAFT post (404)", async () => {
      const agent = await createAgent();
      const user = await createUser();
      const post = await createPost(agent.id, { status: PostStatus.DRAFT });
      const { accessToken } = await loginAs(user);

      const res = await request(app)
        .post(`/api/blog/${post.slug}/comments`)
        .set(bearer(accessToken))
        .send({ content: "Hello" });
      expect(res.status).toBe(404);
    });

    it("lets the comment owner delete, hides it from the public list", async () => {
      const agent = await createAgent();
      const owner = await createUser();
      const stranger = await createUser();
      const post = await createPost(agent.id, { status: PostStatus.PUBLISHED });
      const comment = await createComment(post.id, owner.id);

      // foreign user → uniform 404
      const { accessToken: strangerToken } = await loginAs(stranger);
      const foreign = await request(app)
        .delete(`/api/blog/comments/${comment.id}`)
        .set(bearer(strangerToken));
      expect(foreign.status).toBe(404);

      const { accessToken: ownerToken } = await loginAs(owner);
      const removed = await request(app)
        .delete(`/api/blog/comments/${comment.id}`)
        .set(bearer(ownerToken));
      expect(removed.status).toBe(200);

      const list = await request(app).get(`/api/blog/${post.slug}/comments`);
      expect(list.body.meta.total).toBe(0);
    });
  });

  it("refuses to change the status of a soft-deleted post (400)", async () => {
    const admin = await createAdmin();
    const agent = await createAgent();
    const post = await createPost(agent.id, { isDeleted: true });
    const { accessToken } = await loginAs(admin);

    const res = await request(app)
      .patch(`/api/blog/${post.id}/status`)
      .set(bearer(accessToken))
      .send({ status: PostStatus.PUBLISHED });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/deleted post/i);
  });
});