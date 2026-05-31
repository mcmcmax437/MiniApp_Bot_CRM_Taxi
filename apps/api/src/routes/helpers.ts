import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodSchema } from "zod";

export function parse<T>(schema: ZodSchema<T>, data: unknown, reply: FastifyReply): T | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    reply.code(400).send({ error: "validation_error", issues: result.error.flatten() });
    return undefined;
  }
  return result.data;
}

export function ownerId(req: FastifyRequest): string {
  if (!req.owner) throw new Error("owner not attached to request");
  return req.owner.id;
}

/** Convert ISO date strings to Date objects for the given keys (if present). */
export function toDates<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): T {
  const out: Record<string, unknown> = { ...obj };
  for (const key of keys) {
    const value = out[key as string];
    if (typeof value === "string") {
      out[key as string] = new Date(value);
    }
  }
  return out as T;
}

/** Serialize BigInt values (Prisma) to strings so JSON.stringify does not throw. */
export function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? val.toString() : val)),
  );
}
