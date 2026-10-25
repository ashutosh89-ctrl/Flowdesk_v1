import React, { useMemo } from 'react';
import QRCodeLib from 'qrcode';

export interface QRCodeProps {
  /** The value/URL to encode as dynamic QR code (e.g. upi://pay?pa=...) */
  value?: string;
  /** Direct URL / base64 of an uploaded custom QR code image */
  src?: string;
  /** Dimensions in pixels (width and height) */
  size?: number;
  /** Custom CSS classes */
  className?: string;
  /** Color of dark modules (defaults to #000000 for maximum contrast and scan reliability) */
  darkColor?: string;
  /** Background color (defaults to #ffffff) */
  lightColor?: string;
  /** Accessibility label */
  alt?: string;
  /** Error correction level ('L' | 'M' | 'Q' | 'H') - defaults to 'M' (15% redundancy) */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generates a standard deterministic QR matrix for display and raster canvas export
 * using standard Reed-Solomon error correction via the qrcode engine.
 */
export function generateQrMatrix(
  value: string,
  _matrixSize?: number,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
): boolean[][] {
  if (!value) return [];
  try {
    const qr = QRCodeLib.create(value, { errorCorrectionLevel });
    const size = qr.modules.size;
    const grid: boolean[][] = [];
    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        row.push(qr.modules.get(r, c) === 1);
      }
      grid.push(row);
    }
    return grid;
  } catch (err) {
    console.warn('[QRCode] generateQrMatrix warning:', err);
    return [];
  }
}

/**
 * Universal, scannable QR Code renderer.
 * Supports:
 * 1. Direct display of user-uploaded QR image (src)
 * 2. High-contrast vector SVG QR generator for any standard UPI or web URL (value)
 */
export const QRCode: React.FC<QRCodeProps> = ({
  value,
  src,
  size = 160,
  className = '',
  darkColor = '#000000',
  lightColor = '#ffffff',
  alt = 'Payment QR Code',
  errorCorrectionLevel = 'M',
}) => {
  // Generate scannable vector SVG QR code from value if no uploaded image
  const matrix: boolean[][] = useMemo(() => {
    if (src || !value) return [];
    return generateQrMatrix(value, undefined, errorCorrectionLevel);
  }, [src, value, errorCorrectionLevel]);

  // If an uploaded QR image source is provided, render the image cleanly
  if (src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-white p-1 ${className}`}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain select-none"
          loading="lazy"
        />
      </div>
    );
  }

  if (!value || matrix.length === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 text-xs font-mono select-none ${className}`}
      >
        <span>No QR Data</span>
      </div>
    );
  }

  const matrixSize = matrix.length;
  const cellSize = size / matrixSize;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`inline-block select-none ${className}`}
      aria-label={alt}
      role="img"
    >
      <rect width={size} height={size} fill={lightColor} rx="4" />
      {matrix.map((row, r) =>
        row.map((cell, c) => {
          if (!cell) return null;
          return (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.3}
              height={cellSize + 0.3}
              fill={darkColor}
            />
          );
        })
      )}
    </svg>
  );
};
