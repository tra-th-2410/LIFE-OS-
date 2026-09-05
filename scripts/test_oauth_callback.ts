import assert from 'node:assert/strict';
import { getSiteUrl, getAuthCallbackUrl, getResetPasswordUrl } from '../lib/helpers';

console.log('--- RUNNING OAUTH CALLBACK & SITE URL TEST SUITE ---');

// TEST 1: Server-side environment variable resolution
process.env.NEXT_PUBLIC_SITE_URL = 'https://life-os-study.vercel.app';
const serverSiteUrl = getSiteUrl();
assert.equal(serverSiteUrl, 'https://life-os-study.vercel.app', 'Server site URL should match NEXT_PUBLIC_SITE_URL');
console.log('✅ TEST 1 PASSED: Server resolves site URL to https://life-os-study.vercel.app');

const callbackUrl = getAuthCallbackUrl();
assert.equal(callbackUrl, 'https://life-os-study.vercel.app/auth/callback', 'Callback URL should match https://life-os-study.vercel.app/auth/callback');
console.log('✅ TEST 2 PASSED: Production auth callback URL is https://life-os-study.vercel.app/auth/callback');

const resetPasswordUrl = getResetPasswordUrl();
assert.equal(resetPasswordUrl, 'https://life-os-study.vercel.app/reset-password', 'Reset password URL should match https://life-os-study.vercel.app/reset-password');
console.log('✅ TEST 3 PASSED: Reset password URL is https://life-os-study.vercel.app/reset-password');

// TEST 4: Trailing slash normalization
process.env.NEXT_PUBLIC_SITE_URL = 'https://life-os-study.vercel.app///';
assert.equal(getSiteUrl(), 'https://life-os-study.vercel.app', 'Trailing slashes should be removed');
assert.equal(getAuthCallbackUrl(), 'https://life-os-study.vercel.app/auth/callback');
console.log('✅ TEST 4 PASSED: Trailing slashes normalized properly');

// TEST 5: Fallback when env is empty
delete process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.NEXT_PUBLIC_URL;
assert.equal(getSiteUrl(), 'https://life-os-study.vercel.app', 'Fallback URL should be production domain');
assert.equal(getAuthCallbackUrl(), 'https://life-os-study.vercel.app/auth/callback');
console.log('✅ TEST 5 PASSED: Production fallback returns https://life-os-study.vercel.app/auth/callback');

// TEST 6: Mock client-side browser localhost environment
(global as any).window = {
  location: {
    origin: 'http://localhost:3000',
    hostname: 'localhost',
  },
};
assert.equal(getSiteUrl(), 'http://localhost:3000', 'Localhost browser client should return localhost origin');
assert.equal(getAuthCallbackUrl(), 'http://localhost:3000/auth/callback', 'Localhost browser callback should be http://localhost:3000/auth/callback');
console.log('✅ TEST 6 PASSED: Localhost client dynamically resolves to http://localhost:3000/auth/callback');

// TEST 7: Mock client-side browser production environment
(global as any).window = {
  location: {
    origin: 'https://life-os-study.vercel.app',
    hostname: 'life-os-study.vercel.app',
  },
};
assert.equal(getSiteUrl(), 'https://life-os-study.vercel.app');
assert.equal(getAuthCallbackUrl(), 'https://life-os-study.vercel.app/auth/callback');
console.log('✅ TEST 7 PASSED: Production browser client dynamically resolves to https://life-os-study.vercel.app/auth/callback');

// Cleanup global.window
delete (global as any).window;

// TEST 8: Legacy domain in NEXT_PUBLIC_SITE_URL must be rejected and fallback to production domain
process.env.NEXT_PUBLIC_SITE_URL = 'https://bejewelled-froyo-d5b8de.netlify.app';
assert.equal(getSiteUrl(), 'https://life-os-study.vercel.app', 'Legacy disallowed domain must be rejected');
assert.equal(getAuthCallbackUrl(), 'https://life-os-study.vercel.app/auth/callback');
console.log('✅ TEST 8 PASSED: Legacy domain bejewelled-froyo-d5b8de is rejected and defaults to production domain');

// TEST 9: Legacy domain in browser window.location.origin must be rejected
(global as any).window = {
  location: {
    origin: 'https://bejewelled-froyo-d5b8de.netlify.app',
    hostname: 'bejewelled-froyo-d5b8de.netlify.app',
  },
};
assert.equal(getSiteUrl(), 'https://life-os-study.vercel.app', 'Browser on legacy domain must resolve to production domain');
console.log('✅ TEST 9 PASSED: Browser client on legacy domain is sanitized to production domain');
delete (global as any).window;

// TEST 10: Production mode (NODE_ENV=production) rejects localhost
const originalNodeEnv = process.env.NODE_ENV;
(process.env as any).NODE_ENV = 'production';
delete process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.NEXT_PUBLIC_URL;

(global as any).window = {
  location: {
    origin: 'http://localhost:3000',
    hostname: 'localhost',
  },
};
assert.equal(getSiteUrl(), 'https://life-os-study.vercel.app', 'Localhost in production environment must be rejected');
assert.equal(getAuthCallbackUrl(), 'https://life-os-study.vercel.app/auth/callback');
console.log('✅ TEST 10 PASSED: Localhost in production mode is blocked from auth callbacks');
delete (global as any).window;
(process.env as any).NODE_ENV = originalNodeEnv;

// TEST 11: Vercel URL resolution
process.env.VERCEL_URL = 'life-os-preview.vercel.app';
assert.equal(getSiteUrl(), 'https://life-os-preview.vercel.app');
assert.equal(getAuthCallbackUrl(), 'https://life-os-preview.vercel.app/auth/callback');
console.log('✅ TEST 11 PASSED: Vercel deployment URL dynamically resolves with https');
delete process.env.VERCEL_URL;

// TEST 12: Legacy Netlify domain life-os-study.netlify.app must also be rejected
process.env.NEXT_PUBLIC_SITE_URL = 'https://life-os-study.netlify.app';
assert.equal(getSiteUrl(), 'https://life-os-study.vercel.app', 'Legacy Netlify domain must be rejected in favor of Vercel production domain');
assert.equal(getAuthCallbackUrl(), 'https://life-os-study.vercel.app/auth/callback');
delete process.env.NEXT_PUBLIC_SITE_URL;
console.log('✅ TEST 12 PASSED: Legacy Netlify domain life-os-study.netlify.app is blocked and falls back to Vercel');

console.log('\n🎉 ALL 12/12 OAUTH CALLBACK & REDIRECT TESTS PASSED!');
