import crypto from "crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const createToken = (
  payload: JwtPayload,
  secret: string,
  expiresIn: SignOptions,
) => {
  // jti guarantees byte-unique tokens even within the same iat second —
  // otherwise two tokens minted for the same user in one second collide on
  // the refresh-ledger unique hash (Step 22).
  const token = jwt.sign({ ...payload, jti: crypto.randomUUID() }, secret, expiresIn);

  return token;
};

const verifyToken = (token: string, secret: string) => {
  try {
    const verifiedToken = jwt.verify(token, secret);
    return {
      success: true,
      data: verifiedToken,
    };
  } catch (error: any) {
    console.log("Token Verification Failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const jwtUtils = {
  createToken,
  verifyToken,
};
