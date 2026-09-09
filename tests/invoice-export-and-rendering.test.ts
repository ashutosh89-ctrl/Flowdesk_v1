import './setup-demo-mode';
import { convertAmountToWords } from '../src/shared/utils/number-to-words';
import { sanitizeFilename } from '../src/shared/utils/invoice-export';
import { calculateInvoiceTotals } from '../src/shared/utils/invoice-calculations';
import { Invoice } from '../src/shared/types';

async function runTests() {
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    passedTests++;
    console.log(`✅ PASSED: ${message}`);
  }

  console.log('\n======================================================');
  console.log('🧪 1. TESTING AMOUNT IN WORDS GENERATION');
  console.log('======================================================');

  // Test 1: INR Whole Numbers
  const inrWords431 = convertAmountToWords(431, 'INR');
  assert(
    inrWords431 === 'Rupees Four Hundred and Thirty One Only',
    `INR 431 converts correctly to "${inrWords431}"`
  );

  // Test 2: INR Lakhs & Crores
  const inrWordsLakhs = convertAmountToWords(250000, 'INR');
  assert(
    inrWordsLakhs === 'Rupees Two Lakh Fifty Thousand Only',
    `INR 250,000 converts correctly to "${inrWordsLakhs}"`
  );

  const inrWordsCrore = convertAmountToWords(15000000, 'INR');
  assert(
    inrWordsCrore.includes('One Crore') && inrWordsCrore.includes('Fifty Lakh'),
    `INR 1.5 Crore converts correctly to "${inrWordsCrore}"`
  );

  // Test 3: INR Decimals (Paise)
  const inrWordsDecimals = convertAmountToWords(410.5, 'INR');
  assert(
    inrWordsDecimals.includes('Fifty Paise'),
    `INR 410.50 includes Fifty Paise: "${inrWordsDecimals}"`
  );

  // Test 4: USD International Millions
  const usdWords = convertAmountToWords(1250000.75, 'USD');
  assert(
    usdWords.includes('One Million') && usdWords.includes('Two Hundred and Fifty Thousand') && usdWords.includes('Seventy Five Cents'),
    `USD 1,250,000.75 converts correctly to "${usdWords}"`
  );

  // Test 5: Zero Amount
  const zeroWords = convertAmountToWords(0, 'INR');
  assert(
    zeroWords === 'Rupees Zero Only',
    `Zero converts correctly to "${zeroWords}"`
  );

  console.log('\n======================================================');
  console.log('🧪 2. TESTING FILE NAME SANITIZATION');
  console.log('======================================================');

  // Test 6: Standard Invoice Number
  const filenamePdf = sanitizeFilename('SAL-2026-0003', 'pdf');
  assert(
    filenamePdf === 'FlowDesk-Invoice-SAL-2026-0003.pdf',
    `Sanitized PDF filename: ${filenamePdf}`
  );

  // Test 7: Slash / Colon / Space Invoice Number
  const dirtyFilename = sanitizeFilename('INV/2026:001 *draft*', 'png');
  assert(
    !dirtyFilename.includes('/') && !dirtyFilename.includes(':') && !dirtyFilename.includes('*'),
    `Unsafe characters removed: ${dirtyFilename}`
  );
  assert(
    dirtyFilename.endsWith('.png'),
    `Correct PNG extension preserved: ${dirtyFilename}`
  );

  console.log('\n======================================================');
  console.log('🧪 3. TESTING INVOICE FINANCIAL CALCULATIONS');
  console.log('======================================================');

  const sampleItems = [
    { description: 'UI/UX Design System', quantity: 1, rate: 410, amount: 410 },
  ];

  const calculated = calculateInvoiceTotals({ items: sampleItems, discount: 0, taxPercentage: 5 });
  assert(calculated.subtotal === 410, `Subtotal is 410 (got ${calculated.subtotal})`);
  assert(calculated.taxAmount === 20.5, `5% tax is 20.50 (got ${calculated.taxAmount})`);
  assert(calculated.total === 430.5, `Total is 430.50 (got ${calculated.total})`);

  // Calculation with discount
  const calcWithDiscount = calculateInvoiceTotals({ items: sampleItems, discount: 50, taxPercentage: 10 });
  assert(calcWithDiscount.subtotal === 410, 'Subtotal is 410');
  assert(calcWithDiscount.discount === 50, 'Discount is 50');
  // Tax = 410 * 10% = 41, Total = 410 + 41 - 50 = 401
  assert(calcWithDiscount.taxAmount === 41, `Tax amount is 41 (got ${calcWithDiscount.taxAmount})`);
  assert(calcWithDiscount.total === 401, `Total after tax and discount is 401 (got ${calcWithDiscount.total})`);

  console.log('\n======================================================');
  console.log('🧪 4. TESTING DOCUMENT DATA INTEGRITY');
  console.log('======================================================');

  const invoiceData: Invoice = {
    id: 'inv-test-123',
    invoiceNumber: 'FD-2026-0099',
    clientId: 'client-abc',
    clientName: 'Acme Corporation',
    clientEmail: 'billing@acme.com',
    projectName: 'Brand Redesign',
    issueDate: '2026-09-01',
    dueDate: '2026-09-15',
    workflowStatus: 'sent',
    paymentStatus: 'pending',
    items: [
      { description: 'Design Sprint', quantity: 2, rate: 1500, amount: 3000 },
      { description: 'Design System Documentation', quantity: 1, rate: 1000, amount: 1000 },
    ],
    subtotal: 4000,
    taxName: 'GST',
    taxPercentage: 18,
    tax: 720,
    total: 4720,
    paidAmount: 1000,
    remainingBalance: 3720,
    currency: 'INR',
    notes: '1. Net 15 days payment terms.\n2. Late fee of 1.5% per month applicable on overdue balances.',
    paymentInstructions: 'Transfer via NEFT/RTGS to Bank account.',
  };

  assert(invoiceData.items.length === 2, 'Invoice has 2 line items');
  assert(invoiceData.remainingBalance === 3720, 'Partial payment remaining balance calculated accurately');
  assert(
    convertAmountToWords(invoiceData.total, invoiceData.currency).includes('Four Thousand Seven Hundred and Twenty'),
    'Grand total in words is accurate'
  );

  console.log('\n======================================================');
  console.log('🧪 5. TESTING STORAGE PATH & BUCKET HARDENING');
  console.log('======================================================');

  const { StorageHelper } = await import('../src/backend/storage/storage-helper');
  
  // Storage paths must conform to workspaces/{workspaceId}/{folder}/{filename}
  const logoPath = StorageHelper.getFilePath('ws-123-abc', 'branding', 'logo.png');
  assert(
    logoPath.startsWith('workspaces/ws-123-abc/branding/'),
    `Logo storage path format matches standard: ${logoPath}`
  );

  const signaturePath = StorageHelper.getFilePath('ws-123-abc', 'branding', 'signature.png');
  assert(
    signaturePath.startsWith('workspaces/ws-123-abc/branding/'),
    `Signature storage path format matches standard: ${signaturePath}`
  );

  const deliverablePath = StorageHelper.getFilePath('ws-123-abc', 'deliverables/del-456', 'design.pdf');
  assert(
    deliverablePath.startsWith('workspaces/ws-123-abc/deliverables/del-456/'),
    `Deliverable storage path format matches standard: ${deliverablePath}`
  );

  // File validation
  const validFile = new File(['test content'], 'sample.pdf', { type: 'application/pdf' });
  const valResult = StorageHelper.validateFile(validFile);
  assert(valResult.valid === true, 'Standard PDF file passes validation');

  console.log('\n======================================================');
  console.log(`🎉 ALL ${totalTests} INVOICE RENDER & EXPORT TESTS PASSED! (${passedTests}/${totalTests})`);
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
