import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import auth from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import { blogController } from "./blog.controller";
import { blogValidations } from "./blog.validation";
import { blogCommentController } from "./blogComment.controller";
import { blogCommentValidations } from "./blogComment.validation";

const router = Router();

// NOTE: `/internal/*` routes MUST stay registered before `GET /:slug` below —
// Express matches top-down, and a literal segment (`/internal/all`) would
// otherwise be swallowed by the `:slug` param route and 404 forever.

// 1. All posts (admin moderation UI) — registered before /:slug
router.get(
  "/internal/all",
  auth(Role.ADMIN),
  validateRequest({ query: blogValidations.internalQuerySchema }),
  blogController.getAllPosts,
);

// 1b. Own posts ("My Posts" UI for agents/admins) — before /:slug
router.get(
  "/my-posts",
  auth(Role.AGENT, Role.ADMIN),
  validateRequest({ query: blogValidations.internalQuerySchema }),
  blogController.getMyPosts,
);

// 2. Public listing — PUBLISHED + not-deleted only
router.get(
  "/",
  validateRequest({ query: blogValidations.publicQuerySchema }),
  blogController.getPublicPosts,
);

// 3. Public post detail by slug
router.get(
  "/:slug",
  validateRequest({ params: blogValidations.postSlugParamsSchema }),
  blogController.getPostBySlug,
);

// 4. Create post (agent/admin authors own posts; new posts start DRAFT)
router.post(
  "/",
  auth(Role.AGENT, Role.ADMIN),
  validateRequest({ body: blogValidations.createPostSchema }),
  blogController.createPost,
);

// ── Comments ────────────────────────────────────────────────────────────────
// NOTE: this block stays before PATCH /:id/status so DELETE /comments/:id is
// never shadowed — and no bare PATCH /:slug or DELETE /:slug is ever added.

// 4a. Public comments for a post (PUBLISHED + non-deleted post only)
router.get(
  "/:slug/comments",
  validateRequest({
    params: blogValidations.postSlugParamsSchema,
    query: blogCommentValidations.commentQuerySchema,
  }),
  blogCommentController.getPostComments,
);

// 4b. Create a comment (any authenticated user)
router.post(
  "/:slug/comments",
  auth(),
  validateRequest({
    params: blogValidations.postSlugParamsSchema,
    body: blogCommentValidations.createCommentSchema,
  }),
  blogCommentController.createComment,
);

// 4c. Soft delete a comment (owner or ADMIN)
router.delete(
  "/comments/:id",
  auth(),
  validateRequest({ params: blogCommentValidations.commentParamsSchema }),
  blogCommentController.deleteComment,
);

// 5. Publish/unpublish post (admin) — registered before PATCH /:id for clarity
router.patch(
  "/:id/status",
  auth(Role.ADMIN),
  validateRequest({
    params: blogValidations.postParamsSchema,
    body: blogValidations.updateStatusSchema,
  }),
  blogController.changePostStatus,
);

// 6. Update post (agent own / admin any) — agent edits reset to DRAFT
router.patch(
  "/:id",
  auth(Role.AGENT, Role.ADMIN),
  validateRequest({
    params: blogValidations.postParamsSchema,
    body: blogValidations.updatePostSchema,
  }),
  blogController.updatePost,
);

// 7. Soft delete post (agent own / admin any)
router.delete(
  "/:id",
  auth(Role.AGENT, Role.ADMIN),
  validateRequest({ params: blogValidations.postParamsSchema }),
  blogController.softDeletePost,
);

export const blogRoutes = router;
