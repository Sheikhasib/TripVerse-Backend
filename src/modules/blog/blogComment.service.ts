import { PostStatus, Role } from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { publicAuthorSelect } from "./blog.service";
import { ICreateCommentPayload, ICommentQuery } from "./blogComment.interface";

// Shared visibility rule: comments only ever appear under a PUBLISHED,
// non-deleted post — the same rule as getPostBySlug.
const getPostIdBySlug = async (slug: string): Promise<string> => {
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, isDeleted: false },
    select: { id: true },
  });

  if (!post) {
    throw new AppError(404, "Post not found.");
  }

  return post.id;
};

// 1. Public comments for a post — top-level + their replies in two queries:
//    top-level newest-first, replies oldest-first (conversation order).
const getPostComments = async (slug: string, query: ICommentQuery) => {
  const postId = await getPostIdBySlug(slug);

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const topLevelWhere: Prisma.BlogCommentWhereInput = {
    postId,
    parentId: null,
    isDeleted: false,
  };

  const [topLevel, total] = await Promise.all([
    prisma.blogComment.findMany({
      where: topLevelWhere,
      include: { user: publicAuthorSelect },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.blogComment.count({ where: topLevelWhere }),
  ]);

  const replies = topLevel.length > 0
    ? await prisma.blogComment.findMany({
        where: {
          postId,
          isDeleted: false,
          parentId: { in: topLevel.map((c) => c.id) },
        },
        include: { user: publicAuthorSelect },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const replyMap = new Map<string, typeof replies>();
  for (const reply of replies) {
    const list = replyMap.get(reply.parentId!) ?? [];
    list.push(reply);
    replyMap.set(reply.parentId!, list);
  }

  const data = topLevel.map((comment) => ({
    ...comment,
    replies: replyMap.get(comment.id) ?? [],
  }));

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// 2. Create a comment (any authenticated user). One-level replies only: a
//    parent must be a top-level comment on the same post.
const createComment = async (
  userId: string,
  slug: string,
  payload: ICreateCommentPayload,
) => {
  const postId = await getPostIdBySlug(slug);

  let parentId: string | null = null;
  if (payload.parentId) {
    const parent = await prisma.blogComment.findFirst({
      where: {
        id: payload.parentId,
        postId,
        isDeleted: false,
      },
      select: { id: true, parentId: true },
    });

    if (!parent) {
      throw new AppError(400, "Parent comment not found on this post.");
    }

    if (parent.parentId !== null) {
      throw new AppError(400, "Replies to replies are not allowed.");
    }

    parentId = parent.id;
  }

  return prisma.blogComment.create({
    data: { content: payload.content, postId, userId, parentId },
    include: { user: publicAuthorSelect },
  });
};

// 3. Soft delete a comment — owner or ADMIN. A foreign id, an already-deleted
//    comment, or a nonexistent one is a uniform 404 (never a leak).
const deleteComment = async (
  userId: string,
  role: Role,
  commentId: string,
) => {
  const result = await prisma.blogComment.updateMany({
    where: {
      id: commentId,
      isDeleted: false,
      ...(role !== Role.ADMIN ? { userId } : {}),
    },
    data: { isDeleted: true },
  });

  if (result.count === 0) {
    throw new AppError(404, "Comment not found.");
  }
};

export const blogCommentService = {
  getPostComments,
  createComment,
  deleteComment,
};