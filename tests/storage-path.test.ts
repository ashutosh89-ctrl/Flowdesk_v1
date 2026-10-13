/**
 * FLOWDESK STORAGE PATH & CANONICAL RLS ARCHITECTURE TEST SUITE
 * 
 * Verifies buildStoragePath and sanitizeFileName security requirements:
 * - Path traversal mitigation
 * - Unicode normalization and preservation of safe characters
 * - Long filename truncation with extension preservation
 * - Empty / whitespace-only filename rejection
 * - UUID format validation for workspace and client IDs
 * - Canonical folder layout (clients/ vs shared/ vs branding/)
 * - Collision avoidance via cryptographically unique random prefixes
 * 
 * Zero live Supabase credentials required.
 */

import assert from 'assert';
import { buildStoragePath, sanitizeFileName, StorageHelper } from '../src/backend/storage/storage-helper';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err?.message || err}`);
    failed++;
  }
}

console.log('================================================================');
console.log('🔒 FLOWDESK STORAGE CANONICAL PATH SECURITY TEST SUITE');
console.log('================================================================\n');

const VALID_WS_ID = '11111111-2222-4333-8444-555555555555';
const VALID_CLI_ID = '66666666-7777-4888-8999-000000000000';

// --- SECTION 1: Path Traversal Neutralization ---
console.log('--- SECTION 1: Path Traversal Neutralization ---');

test('Neutralizes standard dot-dot-slash traversal (../../etc/passwd)', () => {
  const sanitized = sanitizeFileName('../../etc/passwd');
  assert(!sanitized.includes('..'), 'Must not contain double dot traversal');
  assert(!sanitized.includes('/'), 'Must not contain forward slashes');
  assert(!sanitized.includes('\\'), 'Must not contain backslashes');
  assert.strictEqual(sanitized, 'passwd');
});

test('Neutralizes Windows backslash traversal (..\\..\\windows\\win.ini)', () => {
  const sanitized = sanitizeFileName('..\\..\\windows\\win.ini');
  assert(!sanitized.includes('..'), 'Must not contain double dots');
  assert(!sanitized.includes('\\'), 'Must not contain backslashes');
  assert.strictEqual(sanitized, 'win.ini');
});

test('Neutralizes inline traversal (folder/../../../file.pdf)', () => {
  const sanitized = sanitizeFileName('folder/../../../file.pdf');
  assert(!sanitized.includes('..'), 'Must not contain ..');
  assert.strictEqual(sanitized, 'file.pdf');
});

test('buildStoragePath isolates traversal attempt inside client folder', () => {
  const path = buildStoragePath({
    bucket: 'documents',
    workspaceId: VALID_WS_ID,
    clientId: VALID_CLI_ID,
    fileName: '../../../secret_client_b.pdf',
  });
  assert(path.startsWith(`workspaces/${VALID_WS_ID}/clients/${VALID_CLI_ID}/`), 'Must be scoped inside client folder');
  assert(!path.includes('..'), 'Must not contain path traversal sequences');
  assert(path.endsWith('_secret_client_b.pdf'), 'Must preserve sanitized base filename');
});

// --- SECTION 2: Unicode Handling & Normalization ---
console.log('\n--- SECTION 2: Unicode Handling & Normalization ---');

test('Preserves valid unicode characters in European languages (café_de_paris.pdf)', () => {
  const sanitized = sanitizeFileName('café_de_paris.pdf');
  assert(sanitized.includes('café'), 'Must preserve unicode characters like é');
  assert(sanitized.endsWith('.pdf'), 'Must preserve extension');
});

test('Preserves accented German and Spanish characters (Über_Diseño.docx)', () => {
  const sanitized = sanitizeFileName('Über_Diseño.docx');
  assert(sanitized.includes('Über'), 'Must preserve Ü');
  assert(sanitized.includes('Diseño'), 'Must preserve ñ');
});

test('Normalizes decomposed unicode (NFD to NFKC)', () => {
  // 'e' followed by combining acute accent (\u0301)
  const decomposed = 're\u0301sume\u0301.pdf';
  const sanitized = sanitizeFileName(decomposed);
  assert(sanitized.normalize('NFKC') === sanitized, 'Must be in NFKC normalized form');
});

test('Strips non-printable control characters (\u0000, \u0008, \u001F)', () => {
  const tainted = 'clean\u0000name\u0008test\u001f.pdf';
  const sanitized = sanitizeFileName(tainted);
  assert(!sanitized.includes('\u0000'), 'Must strip null byte');
  assert(!sanitized.includes('\u0008'), 'Must strip backspace control byte');
  assert(!sanitized.includes('\u001f'), 'Must strip unit separator control byte');
  assert(sanitized.includes('clean') && sanitized.includes('test'), 'Preserves legitimate text');
});

// --- SECTION 3: Length Limiting & Extension Preservation ---
console.log('\n--- SECTION 3: Length Limiting & Extension Preservation ---');

test('Truncates excessively long filenames while strictly preserving extension', () => {
  const longName = 'a'.repeat(250) + '.pdf';
  const sanitized = sanitizeFileName(longName);
  assert(sanitized.endsWith('.pdf'), 'Extension must be preserved');
  assert(sanitized.length <= 100, `Total sanitized length must be <= 100, got ${sanitized.length}`);
});

test('Handles filename with multiple dots properly (archive.tar.gz)', () => {
  const sanitized = sanitizeFileName('archive.tar.gz');
  assert(sanitized.endsWith('.gz'), 'Preserves final extension');
  assert(sanitized.includes('archive'), 'Preserves base name');
});

// --- SECTION 4: Empty & Malformed Filename Rejection ---
console.log('\n--- SECTION 4: Empty & Malformed Filename Rejection ---');

test('Rejects empty string with clear error', () => {
  assert.throws(() => sanitizeFileName(''), /Filename cannot be empty/);
});

test('Rejects whitespace-only string with clear error', () => {
  assert.throws(() => sanitizeFileName('    '), /Filename cannot be empty/);
});

test('Rejects path consisting purely of traversal dots (../../..)', () => {
  assert.throws(() => sanitizeFileName('../../..'), /Filename cannot be empty after sanitization/);
});

test('buildStoragePath throws on empty filename', () => {
  assert.throws(() => {
    buildStoragePath({
      bucket: 'documents',
      workspaceId: VALID_WS_ID,
      clientId: VALID_CLI_ID,
      fileName: '   ',
    });
  }, /Filename cannot be empty/);
});

// --- SECTION 5: UUID Format Enforcement ---
console.log('\n--- SECTION 5: UUID Format Enforcement ---');

test('Rejects workspace ID that is not a valid UUID (simple string)', () => {
  assert.throws(() => {
    buildStoragePath({
      bucket: 'documents',
      workspaceId: 'not-a-valid-uuid',
      clientId: VALID_CLI_ID,
      fileName: 'test.pdf',
    });
  }, /Invalid workspace ID/);
});

test('Rejects workspace ID attempting path traversal (../../evil-tenant)', () => {
  assert.throws(() => {
    buildStoragePath({
      bucket: 'documents',
      workspaceId: '../../evil-tenant',
      clientId: VALID_CLI_ID,
      fileName: 'test.pdf',
    });
  }, /Invalid workspace ID/);
});

test('Rejects client ID that is not a valid UUID', () => {
  assert.throws(() => {
    buildStoragePath({
      bucket: 'documents',
      workspaceId: VALID_WS_ID,
      clientId: 'cli-legacy-format-123',
      fileName: 'test.pdf',
    });
  }, /Invalid client ID/);
});

test('Rejects client ID attempting path injection (../other-client)', () => {
  assert.throws(() => {
    buildStoragePath({
      bucket: 'documents',
      workspaceId: VALID_WS_ID,
      clientId: '../other-client',
      fileName: 'test.pdf',
    });
  }, /Invalid client ID/);
});

// --- SECTION 6: Canonical Layout Output ---
console.log('\n--- SECTION 6: Canonical Layout Output ---');

test('Generates client-scoped canonical path for private documents bucket', () => {
  const path = buildStoragePath({
    bucket: 'documents',
    workspaceId: VALID_WS_ID,
    clientId: VALID_CLI_ID,
    fileName: 'contract.pdf',
  });
  const segments = path.split('/');
  assert.strictEqual(segments[0], 'workspaces');
  assert.strictEqual(segments[1], VALID_WS_ID);
  assert.strictEqual(segments[2], 'clients');
  assert.strictEqual(segments[3], VALID_CLI_ID);
  assert(segments[4].endsWith('_contract.pdf'));
});

test('Generates client-scoped canonical path for private deliverables bucket', () => {
  const path = buildStoragePath({
    bucket: 'deliverables',
    workspaceId: VALID_WS_ID,
    clientId: VALID_CLI_ID,
    fileName: 'design_v1.zip',
  });
  const segments = path.split('/');
  assert.strictEqual(segments[0], 'workspaces');
  assert.strictEqual(segments[1], VALID_WS_ID);
  assert.strictEqual(segments[2], 'clients');
  assert.strictEqual(segments[3], VALID_CLI_ID);
  assert(segments[4].endsWith('_design_v1.zip'));
});

test('Generates shared canonical path when clientId is omitted for private bucket', () => {
  const path = buildStoragePath({
    bucket: 'documents',
    workspaceId: VALID_WS_ID,
    fileName: 'workspace_handbook.pdf',
  });
  const segments = path.split('/');
  assert.strictEqual(segments[0], 'workspaces');
  assert.strictEqual(segments[1], VALID_WS_ID);
  assert.strictEqual(segments[2], 'shared');
  assert(segments[3].endsWith('_workspace_handbook.pdf'));
});

test('Generates branding canonical path for public logos bucket', () => {
  const path = buildStoragePath({
    bucket: 'logos',
    workspaceId: VALID_WS_ID,
    fileName: 'logo.png',
  });
  const segments = path.split('/');
  assert.strictEqual(segments[0], 'workspaces');
  assert.strictEqual(segments[1], VALID_WS_ID);
  assert.strictEqual(segments[2], 'branding');
  assert(segments[3].endsWith('_logo.png'));
});

// --- SECTION 7: Collision Avoidance & Prefix Uniqueness ---
console.log('\n--- SECTION 7: Collision Avoidance & Prefix Uniqueness ---');

test('Generates unique random prefixes for identical file uploads', () => {
  const path1 = buildStoragePath({
    bucket: 'documents',
    workspaceId: VALID_WS_ID,
    clientId: VALID_CLI_ID,
    fileName: 'invoice.pdf',
  });
  const path2 = buildStoragePath({
    bucket: 'documents',
    workspaceId: VALID_WS_ID,
    clientId: VALID_CLI_ID,
    fileName: 'invoice.pdf',
  });
  assert.notStrictEqual(path1, path2, 'Paths for consecutive uploads of same file must be distinct');
});

// --- SECTION 8: StorageHelper Backward Compatibility ---
console.log('\n--- SECTION 8: StorageHelper Backward Compatibility ---');

test('StorageHelper.getFilePath retains legacy format for non-UUID strings', () => {
  const legacyPath = StorageHelper.getFilePath('ws-123-abc', 'branding', 'logo.png');
  assert.strictEqual(legacyPath, 'workspaces/ws-123-abc/branding/logo.png');
});

console.log('\n================================================================');
console.log(`📊 STORAGE PATH RESULTS: ${passed} Passed, ${failed} Failed`);
if (failed === 0) {
  console.log('🎉 ALL STORAGE PATH SECURITY TESTS PASSED!');
} else {
  console.error('❌ SOME TESTS FAILED.');
  process.exit(1);
}
console.log('================================================================\n');

