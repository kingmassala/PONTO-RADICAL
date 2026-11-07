import "server-only";
import { randomInt } from "node:crypto";

/** Palavra-passe temporária legível (sem caracteres ambíguos), mostrada uma única vez. */
export function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const pick = () => alphabet[randomInt(alphabet.length)];
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, pick).join("")).join("-");
}
