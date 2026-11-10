// رموز مرسومة بخط واحد (viewBox 64)، للطباعة والشاشة. لا إيموجي.
const S = 'fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';
export const ICON = {
  // التكليفات
  musalla: `<g ${S}><path d="M10 54V30c0-13 10-22 22-22s22 9 22 22v24"/><path d="M4 54h56"/><path d="M20 54V36c0-7 5-12 12-12s12 5 12 12v18"/><path d="M32 8V4"/><path d="M12 44h8M44 44h8"/></g>`,
  kalima: `<g ${S}><rect x="24" y="6" width="16" height="28" rx="8"/><path d="M14 26c0 10 8 18 18 18s18-8 18-18"/><path d="M32 44v12"/><path d="M20 56h24"/><path d="M8 40l6-6M56 40l-6-6"/></g>`,
  food: `<g ${S}><path d="M6 44h52"/><path d="M12 44c0-12 9-20 20-20s20 8 20 20"/><path d="M32 24v-6"/><path d="M28 18h8"/><path d="M10 52h44"/></g>`,
  clean: `<g ${S}><path d="M40 6 22 38"/><path d="M22 38l-10 8c-2 2-2 4 0 6l4 4c2 2 4 2 6 0l8-10"/><path d="M14 46l10 10"/><path d="M48 14l2-6 2 6 6 2-6 2-2 6-2-6-6-2z" fill="currentColor" stroke="none"/><path d="M54 34l1-3 1 3 3 1-3 1-1 3-1-3-3-1z" fill="currentColor" stroke="none"/></g>`,
  // القيادة
  leader: `<g ${S}><path d="M32 6 10 14v16c0 14 9 24 22 30 13-6 22-16 22-30V14z"/><path d="M32 20l3.5 7 7.5 1-5.5 5.2 1.5 7.5L32 37l-7 3.7 1.5-7.5L21 28l7.5-1z" fill="currentColor" stroke="none"/></g>`,
  deputy: `<g ${S}><path d="M24 8 6 15v13c0 12 8 20 18 25"/><path d="M40 8l18 7v13c0 12-8 20-18 25"/><path d="M32 16l-12 5v9c0 9 5 15 12 19 7-4 12-10 12-19v-9z" fill="currentColor" stroke="none" opacity=".9"/></g>`,
  captain: `<g ${S}><rect x="6" y="20" width="52" height="24" rx="6"/><text x="32" y="40" text-anchor="middle" font-family="Readex Pro,sans-serif" font-weight="700" font-size="22" fill="currentColor" stroke="none">C</text></g>`,
  // السلوكيات (البطاقة المعلّقة)
  coop: `<g ${S}><path d="M8 30l12-8 10 8-6 6"/><path d="M56 30 44 22l-10 8 6 6"/><path d="M24 36l8 8 8-8"/><path d="M14 38v10l18 10 18-10V38"/></g>`,
  sport: `<g ${S}><circle cx="32" cy="40" r="14"/><path d="M26 8l6 18 6-18"/><path d="M20 8h24"/><path d="M32 32l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z" fill="currentColor" stroke="none"/></g>`,
  word: `<g ${S}><path d="M10 12h44v28H28l-12 10V40h-6z"/><path d="M20 22h24M20 30h14"/></g>`,
  // عام
  star: `<path d="M32 4l8.6 17.4 19.2 2.8-13.9 13.5 3.3 19.1L32 47.8l-17.2 9 3.3-19.1L4.2 24.2l19.2-2.8z" fill="currentColor"/>`,
  check: `<g ${S}><path d="M12 34l14 14 26-30"/></g>`,
  clock: `<g ${S}><circle cx="32" cy="34" r="22"/><path d="M32 20v14l9 6"/><path d="M26 6h12"/></g>`,
  mic: `<g ${S}><rect x="24" y="6" width="16" height="28" rx="8"/><path d="M14 26c0 10 8 18 18 18s18-8 18-18"/><path d="M32 44v12M20 56h24"/></g>`,
};
export const svg = (k, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 64 64" aria-hidden="true">${ICON[k] || ""}</svg>`;
