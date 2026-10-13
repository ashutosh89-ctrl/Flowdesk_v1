/**
 * FlowDesk Phase 4A: File Upload Security & Magic-Byte Validation Suite
 * 
 * Verifies server-side file upload controls:
 * 1. Allowed file passes with matching magic bytes and extension
 * 2. Wrong extension with valid magic bytes rejected
 * 3. Valid extension with wrong magic bytes rejected (content mismatch)
 * 4. Oversized file rejected based on bucket-specific limits
 * 5. Double extension attacks rejected (e.g. invoice.pdf.exe, image.png.php)
 * 6. Null bytes in filename rejected
 * 7. Empty file (0 bytes) rejected
 * 8. SVG strictly rejected across buckets
 * 9. Content-Type correctly derived from sniffed magic bytes
 */

import assert from 'assert';
import {
  validateUploadFile,
  sniffMimeType,
} from '../src/backend/storage/upload-validator';

function runUploadValidationTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        FILE UPLOAD VALIDATION & SECURITY TEST SUITE          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  // Magic byte fixtures
  const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
  const FAKE_BYTES = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);

  console.log('--- SECTION 1: Magic Byte Sniffing ---');

  test('sniffMimeType correctly detects PNG, JPEG, PDF', () => {
    assert.strictEqual(sniffMimeType(PNG_BYTES), 'image/png');
    assert.strictEqual(sniffMimeType(JPEG_BYTES), 'image/jpeg');
    assert.strictEqual(sniffMimeType(PDF_BYTES), 'application/pdf');
    assert.strictEqual(sniffMimeType(FAKE_BYTES), null);
  });

  console.log('\n--- SECTION 2: Allowed File Passes ---');

  test('Valid PNG avatar passes validation and derives authoritative MIME', () => {
    const res = validateUploadFile(
      {
        name: 'profile-picture.png',
        size: 500 * 1024, // 500 KB
        type: 'application/octet-stream', // Untrusted client MIME
        bytes: PNG_BYTES,
      },
      'avatars'
    );

    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.sniffedMime, 'image/png');
    assert.strictEqual(Boolean(res.sanitizedName), true);
  });

  test('Valid PDF document passes validation', () => {
    const res = validateUploadFile(
      {
        name: 'service_agreement.pdf',
        size: 2 * 1024 * 1024, // 2 MB
        type: 'application/pdf',
        bytes: PDF_BYTES,
      },
      'documents'
    );

    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.sniffedMime, 'application/pdf');
  });

  console.log('\n--- SECTION 3: Content and Signature Mismatch ---');

  test('Valid extension with wrong magic bytes is rejected', () => {
    // Claims to be PDF, but has JPEG magic bytes
    const res = validateUploadFile(
      {
        name: 'invoice.pdf',
        size: 100 * 1024,
        type: 'application/pdf',
        bytes: JPEG_BYTES,
      },
      'documents'
    );

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error?.includes('signature mismatch'), true);
  });

  test('Wrong extension with valid magic bytes is rejected', () => {
    // Valid PDF bytes, but extension is .exe or .bin
    const res = validateUploadFile(
      {
        name: 'document.exe',
        size: 100 * 1024,
        type: 'application/pdf',
        bytes: PDF_BYTES,
      },
      'documents'
    );

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error?.includes('blocked for security reasons'), true);
  });

  console.log('\n--- SECTION 4: Size Boundary Rejection ---');

  test('Oversized avatar exceeding 2MB is rejected', () => {
    const res = validateUploadFile(
      {
        name: 'avatar_large.png',
        size: 3 * 1024 * 1024, // 3 MB (limit is 2MB)
        type: 'image/png',
        bytes: PNG_BYTES,
      },
      'avatars'
    );

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error?.includes('exceeds the allowable limit'), true);
  });

  test('Oversized deliverable exceeding 25MB is rejected', () => {
    const res = validateUploadFile(
      {
        name: 'project_archive.zip',
        size: 26 * 1024 * 1024, // 26 MB (limit is 25MB)
        type: 'application/zip',
      },
      'deliverables'
    );

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error?.includes('exceeds the allowable limit'), true);
  });

  console.log('\n--- SECTION 5: Double Extensions & Null Byte Injections ---');

  test('Double extension invoice.pdf.exe is rejected', () => {
    const res = validateUploadFile(
      {
        name: 'invoice.pdf.exe',
        size: 50 * 1024,
        type: 'application/octet-stream',
      },
      'documents'
    );

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error?.includes('blocked'), true);
  });

  test('Disguised double extension avatar.png.php is rejected', () => {
    const res = validateUploadFile(
      {
        name: 'avatar.png.php',
        size: 50 * 1024,
        type: 'image/png',
        bytes: PNG_BYTES,
      },
      'avatars'
    );

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error?.includes('blocked'), true);
  });

  test('Null byte in filename is rejected', () => {
    const res = validateUploadFile(
      {
        name: 'invoice.pdf\0.png',
        size: 50 * 1024,
        type: 'image/png',
        bytes: PNG_BYTES,
      },
      'documents'
    );

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error?.includes('null byte'), true);
  });

  test('Empty file (0 bytes) is rejected', () => {
    const res = validateUploadFile(
      {
        name: 'empty.pdf',
        size: 0,
        type: 'application/pdf',
      },
      'documents'
    );

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error?.includes('empty'), true);
  });

  console.log('\n--- SECTION 6: SVG Hardening Rejection ---');

  test('SVG upload is strictly rejected for logos and signatures', () => {
    const resLogo = validateUploadFile(
      {
        name: 'brand-logo.svg',
        size: 10 * 1024,
        type: 'image/svg+xml',
      },
      'logos'
    );
    assert.strictEqual(resLogo.valid, false);

    const resSig = validateUploadFile(
      {
        name: 'signature.svg',
        size: 10 * 1024,
        type: 'image/svg+xml',
      },
      'signatures'
    );
    assert.strictEqual(resSig.valid, false);
  });

  console.log('\n================================================================');
  console.log(`📊 UPLOAD VALIDATION RESULTS: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('🎉 ALL UPLOAD VALIDATION TESTS PASSED!');
    console.log('================================================================');
  }
}

runUploadValidationTests();
