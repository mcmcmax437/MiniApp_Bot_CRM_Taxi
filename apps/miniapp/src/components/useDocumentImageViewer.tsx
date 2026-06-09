import { useCallback, useState, type ReactNode } from "react";
import type { DocumentItem } from "../types";
import { DocumentImageViewer, type DocumentViewerItem, type ImageViewerState } from "./DocumentImageViewer";
import { isImageDocument, openDocumentFile } from "./documentUtils";

export function useDocumentImageViewer() {
  const [state, setState] = useState<ImageViewerState | null>(null);

  const close = useCallback(() => setState(null), []);

  const openDocuments = useCallback((items: DocumentViewerItem[], index = 0) => {
    if (items.length === 0) return;
    setState({ kind: "document", items, index: Math.min(index, items.length - 1) });
  }, []);

  const openDocument = useCallback(
    (doc: Pick<DocumentItem, "id" | "fileName" | "mimeType">) => {
      if (isImageDocument(doc)) {
        openDocuments([{ documentId: doc.id, fileName: doc.fileName }]);
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

  const viewer: ReactNode = (
    <DocumentImageViewer state={state} onClose={close} onIndexChange={setIndex} />
  );

  return { openDocument, openDocuments, openUrl, close, viewer, isOpen: state != null };
}
