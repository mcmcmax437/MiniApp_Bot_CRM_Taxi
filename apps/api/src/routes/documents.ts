import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { ownerId } from "./helpers.js";
import { DocumentRelatedType } from "@taxi/shared";
import { isImageDocument } from "../services/document-image.js";
import { heicBufferToJpeg, isHeicFile } from "../services/heic.js";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function resolveMimeType(doc: { mimeType: string | null; fileName: string }): string {
  if (doc.mimeType?.trim()) return doc.mimeType;
  const lower = doc.fileName.toLowerCase();
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

/** HTTP headers allow ASCII only in quoted filename=; use RFC 5987 filename* for Unicode. */
function contentDispositionInline(fileName: string): string {
  const ascii = fileName
    .replace(/[\r\n"\\]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim()
    .slice(0, 180) || "file";
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function relatedExists(
  oid: string,
  type: DocumentRelatedType,
  id: string,
): Promise<boolean> {
  if (type === DocumentRelatedType.CAR) {
    return Boolean(await prisma.car.findFirst({ where: { id, ownerId: oid } }));
  }
  if (type === DocumentRelatedType.DRIVER) {
    return Boolean(await prisma.driver.findFirst({ where: { id, ownerId: oid } }));
  }
  return Boolean(await prisma.rentalAgreement.findFirst({ where: { id, ownerId: oid } }));
}

export async function documentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/documents", async (req) => {
    const { relatedType, relatedId } = req.query as { relatedType?: string; relatedId?: string };
    return prisma.document.findMany({
      where: {
        ownerId: ownerId(req),
        ...(relatedType ? { relatedType: relatedType as DocumentRelatedType } : {}),
        ...(relatedId ? { relatedId } : {}),
      },
      orderBy: { uploadedAt: "desc" },
    });
  });

  // multipart/form-data: fields relatedType, relatedId + file
  app.post("/documents", async (req, reply) => {
    const oid = ownerId(req);
    const parts = req.parts();
    let relatedType: DocumentRelatedType | undefined;
    let relatedId: string | undefined;
    let setAsCover = false;
    let fileBuffer: Buffer | undefined;
    let originalName = "file";
    let mimeType: string | undefined;

    for await (const part of parts) {
      if (part.type === "file") {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of part.file) {
          size += chunk.length;
          if (size > MAX_BYTES) return reply.code(413).send({ error: "file_too_large" });
          chunks.push(chunk as Buffer);
        }
        fileBuffer = Buffer.concat(chunks);
        originalName = part.filename || originalName;
        mimeType = part.mimetype;
        if (
          (!mimeType || mimeType === "application/octet-stream") &&
          /\.heic$/i.test(originalName)
        ) {
          mimeType = "image/heic";
        }
        if (
          (!mimeType || mimeType === "application/octet-stream") &&
          /\.heif$/i.test(originalName)
        ) {
          mimeType = "image/heif";
        }
      } else if (part.fieldname === "relatedType") {
        relatedType = part.value as DocumentRelatedType;
      } else if (part.fieldname === "relatedId") {
        relatedId = part.value as string;
      } else if (part.fieldname === "setAsCover") {
        setAsCover = part.value === "true" || part.value === "1";
      }
    }

    if (!relatedType || !relatedId || !fileBuffer) {
      return reply.code(400).send({ error: "missing_fields" });
    }
    if (!Object.values(DocumentRelatedType).includes(relatedType)) {
      return reply.code(400).send({ error: "invalid_related_type" });
    }
    if (!(await relatedExists(oid, relatedType, relatedId))) {
      return reply.code(400).send({ error: "invalid_related_id" });
    }

    let storedBuffer = fileBuffer;
    let storedFileName = originalName;
    let storedMimeType = mimeType;
    if (isHeicFile(originalName, mimeType)) {
      try {
        storedBuffer = await heicBufferToJpeg(fileBuffer);
        storedFileName = originalName.replace(/\.heif?c$/i, ".jpg");
        storedMimeType = "image/jpeg";
      } catch (err) {
        req.log.warn({ err, originalName }, "HEIC conversion failed on upload");
      }
    }

    const dir = path.resolve(env.uploadsDir, oid);
    await mkdir(dir, { recursive: true });
    const safeName = storedFileName.replace(/[^\w.\-]/g, "_").slice(-80);
    const stored = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const fullPath = path.join(dir, stored);
    await writeFile(fullPath, storedBuffer);

    const doc = await prisma.document.create({
      data: {
        ownerId: oid,
        relatedType,
        relatedId,
        fileName: storedFileName,
        filePath: path.relative(path.resolve(env.uploadsDir), fullPath),
        mimeType: storedMimeType,
      },
    });

    if (setAsCover && relatedType === DocumentRelatedType.CAR && isImageDocument(doc)) {
      await prisma.car.updateMany({
        where: { id: relatedId, ownerId: oid },
        data: { coverDocumentId: doc.id },
      });
    }

    return doc;
  });

  app.get("/documents/:id/file", async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await prisma.document.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!doc) return reply.code(404).send({ error: "not_found" });
    const fullPath = path.resolve(env.uploadsDir, doc.filePath);
    const mimeType = resolveMimeType(doc);
    if (isHeicFile(doc.fileName, doc.mimeType)) {
      try {
        const jpeg = await heicBufferToJpeg(await readFile(fullPath));
        const previewName = doc.fileName.replace(/\.heif?c$/i, ".jpg");
        reply.header("Content-Disposition", contentDispositionInline(previewName));
        reply.type("image/jpeg");
        reply.header("Cache-Control", "private, max-age=3600");
        return reply.send(jpeg);
      } catch (err) {
        req.log.warn({ err, documentId: id }, "HEIC conversion failed on download");
        return reply.code(422).send({ error: "heic_conversion_failed" });
      }
    }
    reply.header("Content-Disposition", contentDispositionInline(doc.fileName));
    reply.type(mimeType);
    if (mimeType.startsWith("image/")) {
      reply.header("Cache-Control", "private, max-age=3600");
    }
    return reply.send(createReadStream(fullPath));
  });

  app.delete("/documents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await prisma.document.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!doc) return reply.code(404).send({ error: "not_found" });
    await prisma.document.delete({ where: { id } });
    await prisma.car.updateMany({
      where: { ownerId: ownerId(req), coverDocumentId: id },
      data: { coverDocumentId: null },
    });
    try {
      await unlink(path.resolve(env.uploadsDir, doc.filePath));
    } catch {
      /* file may already be gone */
    }
    return { ok: true };
  });
}
