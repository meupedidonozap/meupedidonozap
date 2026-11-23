import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.dfc9e1d2017c4c4499328af8ac12f08f',
  appName: 'meupedidonozap',
  webDir: 'dist',
  // Online shell: published site keeps existing store-specific updates working.
  // Development preview is opt-in and must never be used for distribution.
  server: process.env.MPZ_MOBILE_LIVE_PREVIEW === '1' ? {
    url: 'https://dfc9e1d2-017c-4c44-9932-8af8ac12f08f.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  } : {
    url: 'https://meupedidonozap.lovable.app',
    cleartext: false,
  },
};

export default config;
