import { useCallback, useState, type ReactNode } from "react";
import type { DocumentItem } from "../types";
import { useUpdateDocument } from "../hooks";
import { DocumentImageViewer, type DocumentViewerItem, type ImageViewerState } from "./DocumentImageViewer";
import { isImageDocument, normalizeRotation, openDocumentFile } from "./documentUtils";

export function documentViewerItems(
  docs: Array<Pick<DocumentItem, "id" | "fileName" | "rotation">>,
): DocumentViewerItem[] {
  return docs.map((doc) => ({
    documentId: doc.id,
    fileName: doc.fileName,
    alt: doc.fileName,
    rotation: normalizeRotation(doc.rotation),
  }));
}

export function useDocumentImageViewer() {
  const [state, setState] = useState<ImageViewerState | null>(null);
  const updateDocument = useUpdateDocument();

  const close = useCallback(() => setState(null), []);

  const openDocuments = useCallback((items: DocumentViewerItem[], index = 0) => {
    if (items.length === 0) return;
    setState({ kind: "document", items, index: Math.min(index, items.length - 1) });
  }, []);

  const openDocument = useCallback(
    (doc: Pick<DocumentItem, "id" | "fileName" | "mimeType" | "rotation">) => {
      if (isImageDocument(doc)) {
        openDocuments(documentViewerItems([doc]));
      } else {
        void openDocumentFile(doc.id, doc.fileName);
      }
    },
    [openDocuments],
  );

  const openUrl = useCallback((url: string, alt: string) => {
    setState({ kind: "url", url, alt });
  }, []);

  const setIndex = useCallback((index: number) => {
    setState((prev) => {
      if (prev?.kind !== "document") return prev;
      return { ...prev, index };
    });
  }, []);

  const saveRotation = useCallback(
    (documentId: string, rotation: number) => {
      setState((prev) => {
        if (prev?.kind !== "document") return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.documentId === documentId ? { ...item, rotation } : item,
          ),
        };
      });
      updateDocument.mutate({ id: documentId, rotation });
    },
    [updateDocument],
  );

  const viewer: ReactNode = (
    <DocumentImageViewer
      state={state}
      onClose={close}
      onIndexChange={setIndex}
      onRotationChange={saveRotation}
    />
  );

  return { openDocument, openDocuments, openUrl, close, viewer, isOpen: state != null };
}
