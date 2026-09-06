import React from 'react';

export const Table = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/40 backdrop-blur-md">
    <table className={`w-full text-left text-sm text-zinc-300 ${className}`}>{children}</table>
  </div>
);

export const TableHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <thead className={`bg-zinc-900/80 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/10 ${className}`}>
    {children}
  </thead>
);

export const TableBody = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <tbody className={`divide-y divide-white/5 ${className}`}>{children}</tbody>
);

export const TableRow = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <tr
    onClick={onClick}
    className={`hover:bg-white/[0.04] transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    {children}
  </tr>
);

export const TableHead = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-4 py-3.5 font-medium ${className}`}>{children}</th>
);

export const TableCell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-4 py-4 text-sm font-normal text-zinc-200 ${className}`}>{children}</th>
);
