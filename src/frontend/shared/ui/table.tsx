import React from 'react';

export const Table = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-[#2A2A2A] bg-[#111111]/70 backdrop-blur-md">
    <table className={`w-full text-left text-base text-zinc-200 ${className}`}>{children}</table>
  </div>
);

export const TableHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <thead className={`bg-[#181818] text-sm font-semibold text-zinc-300 uppercase tracking-wider border-b border-[#2A2A2A] ${className}`}>
    {children}
  </thead>
);

export const TableBody = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <tbody className={`divide-y divide-[#2A2A2A]/50 ${className}`}>{children}</tbody>
);

export const TableRow = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <tr
    onClick={onClick}
    className={`hover:bg-[#0047AB]/[0.08] transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    {children}
  </tr>
);

export const TableHead = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-5 py-4 text-sm font-semibold text-zinc-300 ${className}`}>{children}</th>
);

export const TableCell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-5 py-4 text-[15px] sm:text-base font-normal text-zinc-200 ${className}`}>{children}</td>
);
