import React from 'react';
import Image from 'next/image';

export type FlowDeskLogoVariant = 'full' | 'symbol';
export type FlowDeskLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface FlowDeskLogoProps {
  variant?: FlowDeskLogoVariant;
  size?: FlowDeskLogoSize;
  className?: string;
  alt?: string;
  priority?: boolean;
  onClick?: () => void;
}

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', { height: number; fullWidth: number; symbolWidth: number }> = {
  xs: { height: 18, fullWidth: 63, symbolWidth: 18 },
  sm: { height: 24, fullWidth: 84, symbolWidth: 24 },
  md: { height: 32, fullWidth: 112, symbolWidth: 32 },
  lg: { height: 42, fullWidth: 146, symbolWidth: 42 },
  xl: { height: 56, fullWidth: 196, symbolWidth: 56 },
};

export const FlowDeskLogo: React.FC<FlowDeskLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  alt = 'FlowDesk',
  priority = false,
  onClick,
}) => {
  const isNumeric = typeof size === 'number';
  const dimensions = isNumeric
    ? {
        height: size,
        width: variant === 'full' ? Math.round(size * 3.48) : size,
      }
    : {
        height: SIZE_MAP[size].height,
        width: variant === 'full' ? SIZE_MAP[size].fullWidth : SIZE_MAP[size].symbolWidth,
      };

  const assetSrc =
    variant === 'symbol'
      ? '/branding/flowdesk-symbol.png'
      : '/branding/flowdesk-logo-transparent.png';

  const imageElement = (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      style={{
        width: dimensions.width,
        height: dimensions.height,
      }}
      onClick={onClick}
    >
      <Image
        src={assetSrc}
        alt={alt}
        width={dimensions.width * 2}
        height={dimensions.height * 2}
        priority={priority}
        className="w-full h-full object-contain"
        unoptimized
      />
    </div>
  );

  return imageElement;
};

export default FlowDeskLogo;
