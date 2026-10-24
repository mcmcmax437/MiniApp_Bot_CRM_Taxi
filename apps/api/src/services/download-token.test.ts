import { describe, expect, it } from "vitest";
import {
  mintDocumentDownloadToken,
  verifyDocumentDownloadToken,
} from "./download-token.js";

describe("document download tokens", () => {
  it("mints a token that verifies for the same document", () => {
    const { token } = mintDocumentDownloadToken("doc1", "owner1");
    expect(verifyDocumentDownloadToken(token, "doc1")).toEqual({ ownerId: "owner1" });
  });

  it("rejects tokens for a different document id", () => {
    const { token } = mintDocumentDownloadToken("doc1", "owner1");
    expect(verifyDocumentDownloadToken(token, "doc2")).toBeNull();
  });

  it("rejects tampered tokens", () => {
    const { token } = mintDocumentDownloadToken("doc1", "owner1");
    const [payload] = token.split(".");
    expect(verifyDocumentDownloadToken(`${payload}.deadbeef`, "doc1")).toBeNull();
  });
});
