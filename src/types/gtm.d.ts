// src/types/gtm.d.ts
declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

export {};
