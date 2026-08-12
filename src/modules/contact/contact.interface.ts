export interface ICreateContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface IContactQuery {
  page?: number;
  limit?: number;
  isResolved?: boolean;
}