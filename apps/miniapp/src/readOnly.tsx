import { createContext, useContext } from "react";

const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider(props: { readOnly: boolean; children: React.ReactNode }) {
  return <ReadOnlyContext.Provider value={props.readOnly}>{props.children}</ReadOnlyContext.Provider>;
}

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
