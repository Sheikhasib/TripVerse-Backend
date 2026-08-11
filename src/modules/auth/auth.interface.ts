import { Role } from "../../../generated/prisma/enums";

export interface IAuth {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: Role;
}

export interface ILoginUser {
  email: string;
  password: string;
}

export interface IGoogleLoginPayload {
  idToken: string;
}

export interface IDemoLoginPayload {
  role: Role;
}

export interface IRefreshTokenPayload {
  refreshToken: string;
}