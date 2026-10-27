import React from 'react';

export const Table = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-[#176B5B]/30 bg-[#191F1D]">
    <table className={`w-full text-left text-base text-[#F5F5F0] ${className}`}>{children}</table>
  </div>
);

export const TableHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <thead className={`bg-[#141817] text-sm font-semibold text-[#A6B4AE] uppercase tracking-wider border-b border-[#176B5B]/30 ${className}`}>
    {children}
  </thead>
);

export const TableBody = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <tbody className={`divide-y divide-[#176B5B]/20 ${className}`}>{children}</tbody>
);

export const TableRow = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <tr
    onClick={onClick}
    className={`hover:bg-[#176B5B]/10 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    {children}
  </tr>
);

export const TableHead = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-5 py-4 text-sm font-semibold text-[#A6B4AE] ${className}`}>{children}</th>
);

export const TableCell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-5 py-4 text-[15px] sm:text-base font-normal text-[#F5F5F0] ${className}`}>{children}</td>
);
