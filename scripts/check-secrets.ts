#!/usr/bin/env npx tsx
/**
 * FlowDesk Static Secret Scanner
 * Scans tracked source files and assets for hardcoded credentials, JWTs, and API keys.
 * Fails with a non-zero exit code if potential secrets are detected.
 *
 * NOTE: For security compliance, this scanner NEVER prints or logs matched secret values.
 */

import fs from 'fs';
import path from 'path';

interface SecretViolation {
  file: string;
  line: number;
  secretType: string;
}

const ROOT_DIR = path.resolve(__dirname, '..');

// Directories to ignore during scanning
const IGNORED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'coverage',
  'dist',
  'build',
  '.gemini',
]);

// File extensions to scan
const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.sql',
  '.md',
  '.yml',
  '.yaml',
  '.sh',
  '.bash',
]);

// Explicit placeholder words that are safe
const SAFE_PLACEHOLDER_REGEX = /^(your_|placeholder|mock_|dummy_|test_|example|REDACTED|MY_|default_|sample_|<REDACTED)/i;

function isSafeMatch(snippet: string): boolean {
  return SAFE_PLACEHOLDER_REGEX.test(snippet) ||
    snippet.includes('REDACTED') ||
    snippet.includes('your_') ||
    snippet.includes('placeholder') ||
    snippet.includes('xkeysib-your_') ||
    snippet.includes('xkeysib-test-key-') ||
    snippet.includes('re_test_key_') ||
    snippet.includes('rzp_test_your_') ||
    snippet.includes('rzp_live_your_');
}

function scanFile(filePath: string): SecretViolation[] {
  const violations: SecretViolation[] = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Skip self
    if (filePath.endsWith('check-secrets.ts')) {
      continue;
    }

    // 1. Supabase / Generic JWT Token: eyJhbGciOi...
    if (line.includes('eyJhbGciOi')) {
      const jwtMatch = line.match(/eyJhbGciOi[a-zA-Z0-9_\-\.]{25,}/);
      if (jwtMatch && !isSafeMatch(jwtMatch[0])) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: lineNumber,
          secretType: 'JWT Authentication Token (Supabase/OAuth)',
        });
      }
    }

    // 2. Brevo API Key: xkeysib-[a-f0-9]{64}
    if (line.includes('xkeysib-')) {
      const brevoMatch = line.match(/xkeysib-[a-zA-Z0-9_\-]{20,}/);
      if (brevoMatch && !isSafeMatch(brevoMatch[0])) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: lineNumber,
          secretType: 'Brevo API Secret Key',
        });
      }
    }

    // 3. Resend API Key: re_[a-zA-Z0-9]{24,}
    if (line.includes('re_')) {
      const resendMatch = line.match(/['"`]re_[a-zA-Z0-9_]{20,}['"`]/);
      if (resendMatch && !isSafeMatch(resendMatch[0])) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: lineNumber,
          secretType: 'Resend API Secret Key',
        });
      }
    }

    // 4. Razorpay Live Key / Secret
    if (line.includes('rzp_live_')) {
      const rzpMatch = line.match(/rzp_live_[a-zA-Z0-9]{14,}/);
      if (rzpMatch && !isSafeMatch(rzpMatch[0])) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: lineNumber,
          secretType: 'Razorpay Live Key ID',
        });
      }
    }

    // 5. Private Key blocks
    if (line.includes('-----BEGIN ') && line.includes('PRIVATE KEY-----')) {
      violations.push({
        file: path.relative(ROOT_DIR, filePath),
        line: lineNumber,
        secretType: 'Private Key Certificate Block',
      });
    }
  }

  return violations;
}

function walkDir(dir: string): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    // Skip local environment files from tracking scan (covered by gitignore check)
    if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SCANNABLE_EXTENSIONS.has(ext) || entry.name.startsWith('.env')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        FLOWDESK STATIC SOURCE SECRET SCANNER                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const files = walkDir(ROOT_DIR);
  console.log(`Scanning ${files.length} tracked source & configuration files...`);

  let totalViolations = 0;

  for (const file of files) {
    const violations = scanFile(file);
    if (violations.length > 0) {
      for (const v of violations) {
        console.error(`❌ VIOLATION: ${v.file}:${v.line} -> Detected ${v.secretType}`);
        totalViolations++;
      }
    }
  }

  console.log('');
  if (totalViolations > 0) {
    console.error(`🚨 FAILED: Found ${totalViolations} potential secret violation(s) in source code.`);
    console.error('All secrets must be loaded via environment variables (process.env).');
    process.exit(1);
  } else {
    console.log('✅ PASSED: 0 secrets detected. All source files are clean.');
    process.exit(0);
  }
}

main();
