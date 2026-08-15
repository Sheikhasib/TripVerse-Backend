import { randomUUID } from "node:crypto";
import { PostStatus, Role } from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { slugify } from "../../utils/slugify";
import {
  ICreatePostPayload,
  IInternalPostQuery,
  IPostQuery,
  IRequestUser,
  IUpdatePostPayload,
  IUpdatePostStatusPayload,
} from "./blog.interface";

// Public payloads carry the author's display info only — never email/role.
export const publicAuthorSelect = {
  select: { id: true, name: true, avatarUrl: true },
};

// Collision-safe slug: base slug from the title, then `-2`, `-3`, ... using a
// single prefix query. Pure-Bangla/emoji titles can't slugify — fall back to
// `blog-<shortId>` so the URL is always meaningful.
const generateUniqueSlug = async (title: string): Promise<string> => {
  const base = slugify(title) || `blog-${randomUUID().slice(0, 8)}`;

  const existing = await prisma.blogPost.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  const used = new Set(existing.map((p) => p.slug));
  if (!used.has(base)) {
    return base;
  }

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};

// 1. Create a post (AGENT/ADMIN). New posts start DRAFT and never leak into
//    public queries until an admin publishes them.
const createPost = async (user: IRequestUser, payload: ICreatePostPayload) => {
  const slug = await generateUniqueSlug(payload.title);

  return prisma.blogPost.create({
    data: {
      title: payload.title,
      excerpt: payload.excerpt,
      content: payload.content,
      coverImage: payload.coverImage,
      slug,
      authorId: user.id,
    },
    include: { author: publicAuthorSelect },
  });
};

// 2. Public blog listing — PUBLISHED + not-deleted only, search + sort.
const getPublicPosts = async (query: IPostQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.BlogPostWhereInput = {
    status: PostStatus.PUBLISHED,
    isDeleted: false,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { excerpt: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortOrder = query.sortOrder ?? (query.sortBy === "oldest" ? "asc" : "desc");

  const orderByMap: Record<string, Prisma.BlogPostOrderByWithRelationInput> = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    title: { title: sortOrder },
  };

  const orderBy = orderByMap[query.sortBy ?? "newest"] ?? orderByMap.newest;

  const [data, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        createdAt: true,
        updatedAt: true,
        author: publicAuthorSelect,
      },
      skip,
      take: limit,
    }),
    prisma.blogPost.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// 3. Public post detail by slug — PUBLISHED + not-deleted only.
const getPostBySlug = async (slug: string) => {
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, isDeleted: false },
    include: { author: publicAuthorSelect },
  });

  if (!post) {
    throw new AppError(404, "Post not found.");
  }

  return post;
};

// 4. All posts for the admin moderation UI (any status, optional filter).
const getAllPosts = async (query: IInternalPostQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.BlogPostWhereInput = {
    isDeleted: false,
    ...(query.status ? { status: query.status } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.blogPost.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// 4b. The caller's own posts (AGENT/ADMIN "My Posts" UI) — any status, since
//     agents must see their own drafts before an admin publishes them.
const getMyPosts = async (user: IRequestUser, query: IInternalPostQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.BlogPostWhereInput = {
    authorId: user.id,
    isDeleted: false,
    ...(query.status ? { status: query.status } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.blogPost.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Fetch + ownership gate shared by PATCH and DELETE. ADMIN bypasses ownership;
// AGENT edits are confined to their own posts.
const findOwnedPost = async (user: IRequestUser, postId: string) => {
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new AppError(404, "Post not found.");
  }

  if (user.role !== Role.ADMIN && post.authorId !== user.id) {
    throw new AppError(403, "You can only act on your own posts.");
  }

  return post;
};

// 5. Update a post. Slug never changes (keeps links/bookmarks valid).
//    AGENT edits reset status to DRAFT (re-publish via /:id/status);
//    ADMIN edits preserve status.
const updatePost = async (
  user: IRequestUser,
  postId: string,
  payload: IUpdatePostPayload,
) => {
  await findOwnedPost(user, postId);

  const data: Prisma.BlogPostUpdateInput = {
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.excerpt !== undefined ? { excerpt: payload.excerpt } : {}),
    ...(payload.content !== undefined ? { content: payload.content } : {}),
    ...(payload.coverImage !== undefined
      ? { coverImage: payload.coverImage }
      : {}),
    ...(user.role !== Role.ADMIN ? { status: PostStatus.DRAFT } : {}),
  };

  return prisma.blogPost.update({
    where: { id: postId },
    data,
    include: { author: publicAuthorSelect },
  });
};

// 6. Publish/unpublish a post (admin).
const changePostStatus = async (
  postId: string,
  payload: IUpdatePostStatusPayload,
) => {
  const post = await prisma.blogPost.findUniqueOrThrow({
    where: { id: postId },
  });

  if (post.isDeleted) {
    throw new AppError(400, "Cannot change the status of a deleted post.");
  }

  return prisma.blogPost.update({
    where: { id: postId },
    data: { status: payload.status },
    include: { author: publicAuthorSelect },
  });
};

// 7. Soft delete (admin any, agent own).
const softDeletePost = async (user: IRequestUser, postId: string) => {
  await findOwnedPost(user, postId);

  return prisma.blogPost.update({
    where: { id: postId },
    data: { isDeleted: true },
  });
};

export const blogService = {
  createPost,
  getPublicPosts,
  getPostBySlug,
  getAllPosts,
  getMyPosts,
  updatePost,
  changePostStatus,
  softDeletePost,
};
