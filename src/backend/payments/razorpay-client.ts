import Razorpay from 'razorpay';

let razorpayInstance: Razorpay | null = null;

/**
 * Returns the server-side Razorpay SDK instance.
 * Throws an error if called from the browser or if credentials are not configured.
 */
export function getRazorpayClient(): Razorpay {
  if (typeof window !== 'undefined') {
    throw new Error('Razorpay SDK client cannot be initialized in browser context.');
  }

  const key_id = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error(
      'Razorpay server credentials are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
    );
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
  }

  return razorpayInstance;
}

export function isRazorpayConfigured(): boolean {
  if (typeof window !== 'undefined') return false;
  return Boolean(
    (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) &&
      process.env.RAZORPAY_KEY_SECRET
  );
}

export function getRazorpayKeyId(): string {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
  return keyId;
}
