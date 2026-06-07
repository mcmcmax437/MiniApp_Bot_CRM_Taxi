import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoot } from "@telegram-apps/telegram-ui";
import "@fontsource-variable/inter/index.css";
import "@telegram-apps/telegram-ui/dist/styles.css";
import "./styles.css";
import "./i18n";
import { initTelegram, getPlatform } from "./telegram";
import { App } from "./App";

initTelegram();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
});

const platform = /iphone|ipad|ios|macos/i.test(getPlatform()) ? "ios" : "base";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRoot
        appearance="dark"
        platform={platform}
        style={{
          width: "100%",
          minHeight: "100vh",
          background: "#08111F",
          fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <HashRouter>
          <App />
        </HashRouter>
      </AppRoot>
    </QueryClientProvider>
  </React.StrictMode>,
);
