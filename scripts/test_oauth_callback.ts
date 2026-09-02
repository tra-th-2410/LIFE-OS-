import assert from 'node:assert/strict';
import { getSiteUrl, getAuthCallbackUrl, getResetPasswordUrl } from '../lib/helpers';

console.log('--- RUNNING OAUTH CALLBACK & SITE URL TEST SUITE ---');

// TEST 1: Server-side environment variable resolution
process.env.NEXT_PUBLIC_SITE_URL = 'https://life-os-study.netlify.app';
const serverSiteUrl = getSiteUrl();
assert.equal(serverSiteUrl, 'https://life-os-study.netlify.app', 'Server site URL should match NEXT_PUBLIC_SITE_URL');
console.log('✅ TEST 1 PASSED: Server resolves site URL to https://life-os-study.netlify.app');

const callbackUrl = getAuthCallbackUrl();
assert.equal(callbackUrl, 'https://life-os-study.netlify.app/auth/callback', 'Callback URL should match https://life-os-study.netlify.app/auth/callback');
console.log('✅ TEST 2 PASSED: Production auth callback URL is https://life-os-study.netlify.app/auth/callback');

const resetPasswordUrl = getResetPasswordUrl();
assert.equal(resetPasswordUrl, 'https://life-os-study.netlify.app/reset-password', 'Reset password URL should match https://life-os-study.netlify.app/reset-password');
console.log('✅ TEST 3 PASSED: Reset password URL is https://life-os-study.netlify.app/reset-password');

// TEST 4: Trailing slash normalization
process.env.NEXT_PUBLIC_SITE_URL = 'https://life-os-study.netlify.app///';
assert.equal(getSiteUrl(), 'https://life-os-study.netlify.app', 'Trailing slashes should be removed');
assert.equal(getAuthCallbackUrl(), 'https://life-os-study.netlify.app/auth/callback');
console.log('✅ TEST 4 PASSED: Trailing slashes normalized properly');

// TEST 5: Fallback when env is empty
delete process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.NEXT_PUBLIC_URL;
assert.equal(getSiteUrl(), 'https://life-os-study.netlify.app', 'Fallback URL should be production domain');
assert.equal(getAuthCallbackUrl(), 'https://life-os-study.netlify.app/auth/callback');
console.log('✅ TEST 5 PASSED: Production fallback returns https://life-os-study.netlify.app/auth/callback');

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
    origin: 'https://life-os-study.netlify.app',
    hostname: 'life-os-study.netlify.app',
  },
};
assert.equal(getSiteUrl(), 'https://life-os-study.netlify.app');
assert.equal(getAuthCallbackUrl(), 'https://life-os-study.netlify.app/auth/callback');
console.log('✅ TEST 7 PASSED: Production browser client dynamically resolves to https://life-os-study.netlify.app/auth/callback');

// Cleanup global.window
delete (global as any).window;

console.log('\n🎉 ALL 7/7 OAUTH CALLBACK & REDIRECT TESTS PASSED!');
