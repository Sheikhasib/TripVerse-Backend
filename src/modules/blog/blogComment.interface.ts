export interface ICreateCommentPayload {
  content: string;
  parentId?: string;
}

export interface ICommentQuery {
  page?: number;
  limit?: number;
}