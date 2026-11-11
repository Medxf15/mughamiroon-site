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
  flag: `<g ${S}><path d="M14 58V8"/><path d="M14 10h34l-8 12 8 12H14"/></g>`,
  gem: `<g ${S}><path d="M18 8h28l12 16-26 34L6 24z"/><path d="M6 24h52"/><path d="M24 8l-6 16 14 34 14-34-6-16"/></g>`,
  // عام
  star: `<path d="M32 4l8.6 17.4 19.2 2.8-13.9 13.5 3.3 19.1L32 47.8l-17.2 9 3.3-19.1L4.2 24.2l19.2-2.8z" fill="currentColor"/>`,
  check: `<g ${S}><path d="M12 34l14 14 26-30"/></g>`,
  clock: `<g ${S}><circle cx="32" cy="34" r="22"/><path d="M32 20v14l9 6"/><path d="M26 6h12"/></g>`,
  mic: `<g ${S}><rect x="24" y="6" width="16" height="28" rx="8"/><path d="M14 26c0 10 8 18 18 18s18-8 18-18"/><path d="M32 44v12M20 56h24"/></g>`,
};
export const svg = (k, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 64 64" aria-hidden="true">${ICON[k] || ""}</svg>`;

/** شارات المستويات الستة: رسم + إطار مختلف البنية لكل مستوى. viewBox 64×72، تُرسم بحبر #14284b ولكنة var(--tc). */
const I = "#14284b";
const SH = "M32 3 7 12v22c0 17 11 30 25 36 14-6 25-19 25-36V12z";
const ln = (w = 3) => `fill="none" stroke="${I}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const tint = (d, o = 0.14) => `<path d="${d}" fill="var(--tc)" opacity="${o}"/>`;
export const EMBLEM = [
  // 0 راكب: حقيبة الطريق داخل لوح مربع
  `<rect x="8" y="10" width="48" height="52" rx="9" fill="var(--tc)" opacity=".14"/><rect x="8" y="10" width="48" height="52" rx="9" ${ln(2.6)}/><g ${ln(3)}><path d="M18 31c0-9 6-14 14-14s14 5 14 14v22a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z"/><path d="M18 37q14 9 28 0"/><path d="M29 17v-5h6v5"/><rect x="25" y="43" width="14" height="8" rx="2.5"/><path d="M13 34v17M51 34v17"/></g>`,
  // 1 رفيق: حلقتان متشابكتان في درع
  `${tint(SH)}<path d="${SH}" ${ln(2.6)}/><path d="M32 9 12 16v18c0 14 8 25 20 31 12-6 20-17 20-31V16z" fill="none" stroke="var(--tc)" stroke-width="1.4"/><g ${ln(3.4)}><circle cx="24.5" cy="36" r="10.5"/><circle cx="39.5" cy="36" r="10.5"/></g>`,
  // 2 سَنَد: عمودان يسندان سقفًا، درع بإطار مزدوج
  `${tint(SH)}<path d="${SH}" ${ln(2.6)}/><path d="M32 9 12 16v18c0 14 8 25 20 31 12-6 20-17 20-31V16z" fill="none" stroke="var(--tc)" stroke-width="1.4"/><g ${ln(3.2)}><path d="M32 18 46 27H18z"/><path d="M23 30v22M41 30v22M32 30v22"/><path d="M17 53h30"/></g>`,
  // 3 خبير الدرب: بوصلة في ثماني الأضلاع
  `${tint("M22 4h20l18 18v28L42 68H22L4 50V22z")}<path d="M22 4h20l18 18v28L42 68H22L4 50V22z" ${ln(2.6)}/><path d="M23 10h18l15 15v22L41 62H23L8 47V25z" fill="none" stroke="var(--tc)" stroke-width="1.4"/><g ${ln(2.8)}><circle cx="32" cy="36" r="14"/></g><path d="M32 24l5 12-5 12-5-12z" fill="${I}"/><path d="M32 24l5 12h-10z" fill="var(--tc)"/>`,
  // 4 حادي القافلة: مكبّر صوت، درع بتاج ثلاثي
  `${tint("M32 10 10 6v28c0 17 9 28 22 34 13-6 22-17 22-34V6z")}<path d="M10 6l11 8 11-9 11 9 11-8v28c0 17-9 28-22 34C19 62 10 51 10 34z" ${ln(2.6)}/><g ${ln(3)}><path d="M18 34l18-9v22l-18-9z"/><path d="M18 34v9"/><path d="M41 29c4 3 4 12 0 15"/><path d="M46 25c7 6 7 17 0 23"/></g>`,
  // 5 شيخ القافلة: قمة بها راية ونجمة، درع مرصّع
  `${tint("M32 4 14 10V3l9 5 9-6 9 6 9-5v7z M7 12v22c0 17 11 30 25 36 14-6 25-19 25-36V12z", 0.22)}<path d="M7 12v22c0 17 11 30 25 36 14-6 25-19 25-36V12L48 8l-9 5-7-9-7 9-9-5z" ${ln(2.6)}/><path d="M32 14 12 20v14c0 14 8 25 20 31 12-6 20-17 20-31V20z" fill="none" stroke="var(--tc)" stroke-width="1.4"/><g ${ln(3)}><path d="M14 52l12-22 7 10 5-8 12 20z"/><path d="M26 30v-9"/></g><path d="M26 21h9l-3 3 3 3h-9z" fill="var(--tc)" stroke="${I}" stroke-width="1.2"/>`,
];
