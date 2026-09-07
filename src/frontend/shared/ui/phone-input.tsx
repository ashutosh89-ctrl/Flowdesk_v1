import React from 'react';
import {
  getCountryByNameOrCode,
  extractNationalDigits,
  validateInternationalPhone,
} from '@/shared/utils/countries';
import { Phone } from 'lucide-react';

export interface PhoneInputProps {
  label?: string;
  value?: string;
  country?: string;
  onChange: (fullPhoneNumber: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label,
  value = '',
  country = 'India',
  onChange,
  className = '',
  placeholder,
  disabled = false,
  required = false,
  error,
}) => {
  const countryInfo = getCountryByNameOrCode(country);
  const { nationalDigits } = extractNationalDigits(value, country);

  const handleDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Extract only digits from user input
    const cleanDigits = rawVal.replace(/\D/g, '');
    if (!cleanDigits) {
      onChange('');
    } else {
      onChange(`${countryInfo.dialCode} ${cleanDigits}`);
    }
  };

  const dynamicPlaceholder = placeholder || countryInfo.example;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-zinc-400">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        {/* Dial Code Prefix Pill */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-xs font-mono font-semibold text-zinc-200 select-none shrink-0 shadow-inner">
          <span className="text-sm leading-none">{countryInfo.flag}</span>
          <span className="text-emerald-400">{countryInfo.dialCode}</span>
        </div>

        {/* National Number Input */}
        <div className="relative flex-1">
          <input
            type="tel"
            value={nationalDigits}
            onChange={handleDigitsChange}
            placeholder={dynamicPlaceholder}
            disabled={disabled}
            required={required}
            className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 focus:border-white/30 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-all disabled:opacity-50 font-mono tracking-wide"
          />
          <Phone className="w-3.5 h-3.5 text-zinc-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
      {error && <p className="text-[11px] text-rose-400 font-medium">{error}</p>}
    </div>
  );
};
