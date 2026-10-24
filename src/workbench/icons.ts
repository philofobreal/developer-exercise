/** Code-native icons share one visual language and never replace accessible labels. */
const paths={
 code:'<path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18"/>',
 sort:'<path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4"/>',
 edit:'<path d="m15 5 4 4M4 20l4-1L20 7a3 3 0 0 0-4-4L4 15z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
 paste:'<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="2" width="6" height="6" rx="1"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 reset:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
 fullscreen:'<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
 grip:'<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
 up:'<path d="m6 14 6-6 6 6"/>',down:'<path d="m6 10 6 6 6-6"/>',back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
 file:'<path d="M14 2H5v20h14V7zm0 0v6h5M8 12h8m-8 4h8"/>',
 settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 save:'<path d="M4 3h14l3 3v15H3V3zm3 0v6h10V3M7 21v-8h10v8"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>'
} as const;
export type IconName=keyof typeof paths;
export const icon=(name:IconName):string=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
