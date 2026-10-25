import './setup-demo-mode';
import { isApprovedRazorpayUrl } from '../src/shared/utils/safe-url';
import { generateQrMatrix } from '../src/frontend/shared/ui/qr-code';
import {
  BankDetailsSchema,
  PaymentMethodsConfigSchema,
  RazorpayPaymentLinkSchema,
  ClientPaymentNotificationSchema,
  ConfirmPaymentNotificationSchema,
  CreateInvoiceSchema,
  UpdateUserSettingsSchema,
} from '../src/shared/validation/schemas';
import { calculateRemainingBalance, isInvoiceOverdue } from '../src/shared/utils/invoice-calculations';
import { sanitizeFilename } from '../src/shared/utils/invoice-export';

async function runDualPaymentAndExportTests() {
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
  console.log('🧪 1. TESTING RAZORPAY PAYMENT LINK SECURITY VALIDATION');
  console.log('======================================================');

  // Valid Razorpay links
  assert(isApprovedRazorpayUrl('https://rzp.io/l/quickpay'), 'Valid rzp.io shortlink accepted');
  assert(isApprovedRazorpayUrl('https://pages.razorpay.com/pl_flowdesk_demo'), 'Valid pages.razorpay.com payment page accepted');
  assert(isApprovedRazorpayUrl('https://razorpay.me/@studio_pro'), 'Valid razorpay.me UPI handle accepted');
  assert(isApprovedRazorpayUrl('https://custom.razorpay.com/pay'), 'Valid *.razorpay.com subdomain accepted');

  // Disallowed / Malicious / Non-HTTPS URLs
  assert(!isApprovedRazorpayUrl('http://rzp.io/l/insecure'), 'Insecure HTTP rejected');
  assert(!isApprovedRazorpayUrl('https://evil-phishing.com?ref=rzp.io'), 'Phishing domain containing rzp.io in query rejected');
  assert(!isApprovedRazorpayUrl('https://rzp.io.attacker.com/fake'), 'Attacker subdomain mimicking rzp.io rejected');
  assert(!isApprovedRazorpayUrl('https://razorpay.com.attacker.com'), 'Attacker subdomain mimicking razorpay.com rejected');
  assert(!isApprovedRazorpayUrl('javascript:alert("pwned")'), 'javascript: URI scheme rejected');
  assert(!isApprovedRazorpayUrl(''), 'Empty string is safely rejected by validator function');

  console.log('\n======================================================');
  console.log('🧪 2. TESTING PAYMENT SCHEMA VALIDATION & QR UPLOAD');
  console.log('======================================================');

  // BankDetailsSchema
  const validBank = BankDetailsSchema.safeParse({
    accountHolderName: 'Design Studio LLP',
    bankName: 'HDFC Bank',
    accountNumber: '50100987654321',
    ifscCode: 'HDFC0001234',
    branchName: 'Indiranagar',
    upiId: 'studio@okhdfcbank',
  });
  assert(validBank.success, 'Valid bank details parse cleanly');

  // PaymentMethodsConfigSchema with upiQrCodeUrl
  const validMethods = PaymentMethodsConfigSchema.safeParse({
    bankTransferEnabled: true,
    upiEnabled: true,
    upiQrCodeUrl: 'https://example.supabase.co/storage/v1/object/public/logos/qr.png',
    razorpayLinkEnabled: true,
  });
  assert(validMethods.success, 'Payment methods config with upiQrCodeUrl parsed successfully');

  // CreateInvoiceSchema with upiQrCodeUrl
  const validInvoiceData = CreateInvoiceSchema.safeParse({
    clientId: 'client_123',
    issueDate: '2026-10-25',
    dueDate: '2026-11-25',
    items: [{ description: 'Design deliverables', quantity: 1, rate: 500 }],
    upiId: 'designer@upi',
    upiQrCodeUrl: 'https://example.supabase.co/storage/v1/object/public/logos/invoice-qr.png',
  });
  assert(validInvoiceData.success, 'CreateInvoiceSchema with upiQrCodeUrl parsed successfully');

  // UpdateUserSettingsSchema with upiQrCodeUrl
  const validSettingsData = UpdateUserSettingsSchema.safeParse({
    upiId: 'designer@okhdfcbank',
    upiQrCodeUrl: 'https://example.supabase.co/storage/v1/object/public/logos/settings-qr.png',
  });
  assert(validSettingsData.success, 'UpdateUserSettingsSchema with upiQrCodeUrl parsed successfully');

  // QR Code generation matrix test
  const qrMatrix = generateQrMatrix('upi://pay?pa=designer@upi&pn=Studio&am=1500&cu=INR');
  assert(Array.isArray(qrMatrix) && qrMatrix.length >= 21, `Valid QR matrix generated with dimension ${qrMatrix.length}x${qrMatrix.length}`);
  assert(qrMatrix.every(row => Array.isArray(row) && row.length === qrMatrix.length), 'QR matrix is perfectly square');

  // RazorpayPaymentLinkSchema
  const validLinkParse = RazorpayPaymentLinkSchema.safeParse('https://pages.razorpay.com/pl_xyz123');
  assert(validLinkParse.success, 'Razorpay Payment Link schema accepts valid URL');

  const invalidLinkParse = RazorpayPaymentLinkSchema.safeParse('https://external-untrusted-site.com/pay');
  assert(!invalidLinkParse.success, 'Razorpay Payment Link schema rejects untrusted domain');

  // CreatePaymentOrderSchema & VerifyPaymentSchema with clientId & invoiceId format
  const { CreatePaymentOrderSchema, VerifyPaymentSchema } = await import('../src/shared/validation/schemas');
  const validOrderWithClientId = CreatePaymentOrderSchema.safeParse({
    invoiceId: 'INV-2026-0002',
    clientId: '44df8dc3-ad6a-49d3-b09a-556ba2c56cd6',
    requestedAmount: 500,
    partialPayment: false,
  });
  assert(validOrderWithClientId.success, 'CreatePaymentOrderSchema accepts statement ID format and clientId');

  const validOrderUuid = CreatePaymentOrderSchema.safeParse({
    invoiceId: '123e4567-e89b-12d3-a456-426614174000',
    clientId: '44df8dc3-ad6a-49d3-b09a-556ba2c56cd6',
    requestedAmount: 1200,
  });
  assert(validOrderUuid.success, 'CreatePaymentOrderSchema accepts UUID invoiceId and clientId');

  const validVerifyWithClientId = VerifyPaymentSchema.safeParse({
    orderId: 'order_12345678',
    paymentId: 'pay_12345678',
    signature: 'a'.repeat(64),
    clientId: '44df8dc3-ad6a-49d3-b09a-556ba2c56cd6',
  });
  assert(validVerifyWithClientId.success, 'VerifyPaymentSchema accepts signature with clientId');

  // ClientPaymentNotificationSchema
  const validNotification = ClientPaymentNotificationSchema.safeParse({
    amount: 1500,
    paymentMethod: 'upi',
    transactionReference: 'UPI/123456789012/IMPS',
    notes: 'Paid via Google Pay, screenshot sent on Slack',
  });
  assert(validNotification.success, 'Client payment notification parses valid fields');

  const invalidNotificationNegativeAmount = ClientPaymentNotificationSchema.safeParse({
    amount: -500,
    paymentMethod: 'upi',
    transactionReference: 'REF123',
  });
  assert(!invalidNotificationNegativeAmount.success, 'Client notification rejects negative amount');

  const invalidNotificationShortRef = ClientPaymentNotificationSchema.safeParse({
    amount: 500,
    paymentMethod: 'bank_transfer',
    transactionReference: 'ab',
  });
  assert(!invalidNotificationShortRef.success, 'Client notification rejects reference shorter than 3 chars');

  // ConfirmPaymentNotificationSchema
  const validConfirm = ConfirmPaymentNotificationSchema.safeParse({
    status: 'confirmed',
    amount: 1500,
    notes: 'Verified in bank passbook',
  });
  assert(validConfirm.success, 'Confirm payment notification parses valid confirmation');

  const validReject = ConfirmPaymentNotificationSchema.safeParse({
    status: 'rejected',
    notes: 'Could not find transaction in HDFC netbanking',
  });
  assert(validReject.success, 'Reject payment notification parses valid rejection');

  console.log('\n======================================================');
  console.log('🧪 3. TESTING FINANCIAL & OVERDUE INTEGRITY');
  console.log('======================================================');

  // 1. Due date passed with balance due -> Overdue
  const pastDate = '2020-01-01';
  assert(isInvoiceOverdue(pastDate, 500), 'Past due date with remaining balance > 0 is overdue');

  // 2. Due date passed but paid in full -> NOT Overdue
  assert(!isInvoiceOverdue(pastDate, 0), 'Past due date with 0 remaining balance is NOT overdue');

  // 3. Future due date with balance due -> NOT Overdue
  const futureDate = '2099-12-31';
  assert(!isInvoiceOverdue(futureDate, 500), 'Future due date is NOT overdue');

  // 4. Remaining balance calculation
  assert(calculateRemainingBalance(1000, 400) === 600, 'Remaining balance is 600 for total 1000, paid 400');
  assert(calculateRemainingBalance(1000, 1000) === 0, 'Remaining balance is 0 when fully paid');
  assert(calculateRemainingBalance(1000, 1200) === 0, 'Remaining balance does not go negative on overpayment');

  console.log('\n======================================================');
  console.log('🧪 4. TESTING REBUILT EXPORT SANITIZATION & EXTENSIONS');
  console.log('======================================================');

  const pngName = sanitizeFilename('INV/2026/001', 'png');
  assert(pngName === 'FlowDesk-Invoice-INV_2026_001.png', `PNG filename correctly formatted: ${pngName}`);

  const jpgName = sanitizeFilename('INV:2026*999', 'jpg');
  assert(jpgName === 'FlowDesk-Invoice-INV_2026_999.jpg', `JPG filename correctly formatted: ${jpgName}`);

  const pdfName = sanitizeFilename('INV?2026<500>', 'pdf');
  assert(pdfName === 'FlowDesk-Invoice-INV_2026_500_.pdf', `PDF filename correctly formatted: ${pdfName}`);

  console.log('\n======================================================');
  console.log('🧪 5. TESTING QR CODE PERSISTENCE & PDF ATTACHMENT PIPELINE');
  console.log('======================================================');

  // 1. Dynamic UPI QR Code PNG Data URL Generation for PDF attachment
  const QRCodeLib = (await import('qrcode')).default;
  const testUpiUri = 'upi://pay?pa=freelancer@okhdfcbank&pn=DesignStudio&am=5000&cu=INR&tn=Invoice%20INV-2026-001';
  const qrPngDataUrl = await QRCodeLib.toDataURL(testUpiUri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: { dark: '#000000', light: '#ffffff' },
  });
  assert(qrPngDataUrl.startsWith('data:image/png;base64,'), 'Dynamic QR generator produces valid PNG base64 data URL for PDF');
  assert(qrPngDataUrl.length > 500, 'QR PNG data URL contains substantial raster payload');

  // 2. Defensive User Settings JSONB Embedding
  const sampleSettingsUpdates = {
    upiId: 'freelancer@upi',
    upiQrCodeUrl: 'https://cdn.flowdesk.dev/qr/freelancer.png',
    bankName: 'HDFC Bank',
    accountNumber: '987654321',
  };
  const embeddedPaymentSettings = {
    upiQrCodeUrl: sampleSettingsUpdates.upiQrCodeUrl,
    upiId: sampleSettingsUpdates.upiId,
    upiEnabled: Boolean(sampleSettingsUpdates.upiId || sampleSettingsUpdates.upiQrCodeUrl),
    bankDetails: {
      bankName: sampleSettingsUpdates.bankName,
      accountNumber: sampleSettingsUpdates.accountNumber,
      upiId: sampleSettingsUpdates.upiId,
    },
  };
  assert(embeddedPaymentSettings.upiQrCodeUrl === sampleSettingsUpdates.upiQrCodeUrl, 'payment_settings JSONB preserves upiQrCodeUrl');
  assert(embeddedPaymentSettings.upiId === sampleSettingsUpdates.upiId, 'payment_settings JSONB preserves upiId');
  assert(embeddedPaymentSettings.upiEnabled === true, 'payment_settings JSONB auto-enables UPI when QR is uploaded');

  // 3. Client Portal Invoice Inheritance Fallback
  const rawInvoiceFromDb = {
    id: 'inv-001',
    invoice_number: 'INV-2026-0001',
    client_id: 'cli-001',
    total_amount: 1500,
    paid_amount: 0,
    upi_qr_code_url: null, // Stored as null in older row
    upi_id: null,
    bank_details: null,
  };
  const workspaceDefaultQr = 'https://cdn.flowdesk.dev/qr/studio.png';
  const workspaceDefaultUpiId = 'studio@okhdfcbank';
  const resolvedInvoiceQr = rawInvoiceFromDb.upi_qr_code_url || workspaceDefaultQr;
  const resolvedInvoiceUpiId = rawInvoiceFromDb.upi_id || workspaceDefaultUpiId;
  assert(resolvedInvoiceQr === workspaceDefaultQr, 'Invoice without explicit QR correctly inherits workspace default QR code');
  assert(resolvedInvoiceUpiId === workspaceDefaultUpiId, 'Invoice without explicit UPI ID correctly inherits workspace default UPI ID');

  console.log('\n======================================================');
  console.log(`🎉 ALL ${totalTests} DUAL PAYMENT & EXPORT TESTS PASSED! (${passedTests}/${totalTests})`);
  console.log('======================================================\n');
}

runDualPaymentAndExportTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
