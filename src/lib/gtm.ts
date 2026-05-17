// src/lib/gtm.ts
export const sendGTMEvent = (event: Record<string, unknown>) => {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
  }
};
