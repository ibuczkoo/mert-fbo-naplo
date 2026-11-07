import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

// Új verzió esetén a felhasználó dönt a frissítésről, hogy kitöltés közben ne töltődjön újra az oldal.
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Elérhető az alkalmazás új verziója. Frissítsünk most?")) void updateSW(true);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
