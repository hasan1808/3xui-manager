import { jwtVerify } from "jose";
import { getJwtSecretBytes } from "./secret";

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
