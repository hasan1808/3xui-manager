import { jwtVerify } from "jose";
import { getJwtSecretBytes } from "./secret";

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes());
    return payload as { username: string; role: string };
  } catch {
    return null;
  }
}
