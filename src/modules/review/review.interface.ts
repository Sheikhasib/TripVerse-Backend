export interface ICreateReviewPayload {
  packageId: string;
  rating: number;
  comment: string;
}

export interface IReviewQuery {
  page?: number;
  limit?: number;
}
