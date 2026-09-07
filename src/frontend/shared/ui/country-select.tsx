import React from 'react';
import { COUNTRIES, CountryInfo, getCountryByNameOrCode } from '@/shared/utils/countries';
import { Globe } from 'lucide-react';

export interface CountrySelectProps {
  label?: string;
  value?: string;
  onChange: (countryName: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  label,
  value,
  onChange,
  className = '',
  disabled = false,
  required = false,
}) => {
  const selectedCountry = getCountryByNameOrCode(value);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-zinc-400">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-xs">
          <span className="text-base leading-none">{selectedCountry.flag}</span>
        </div>
        <select
          value={selectedCountry.name}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          className="w-full pl-9 pr-8 py-2.5 bg-zinc-900/90 hover:bg-zinc-900 border border-white/10 focus:border-white/30 rounded-xl text-xs text-white focus:outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.name} className="bg-zinc-950 text-white">
              {c.flag} {c.name} ({c.dialCode})
            </option>
          ))}
        </select>
        <Globe className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
};
