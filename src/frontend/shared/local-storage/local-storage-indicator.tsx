'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/frontend/shared/ui/button';
import {
  isFileSystemAccessSupported,
  pickWorkspaceDirectory,
  getPersistedDirectoryHandle,
} from './local-file-system';
import { FolderCheck, HardDrive, ShieldCheck, RefreshCw } from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';

export const LocalStorageIndicator: React.FC = () => {
  const [folderName, setFolderName] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setSupported(isFileSystemAccessSupported());
    getPersistedDirectoryHandle().then((result) => {
      if (result) setFolderName(result.name);
    });
  }, []);

  const handleSelectFolder = async () => {
    setConnecting(true);
    try {
      const result = await pickWorkspaceDirectory();
      if (result) {
        setFolderName(result.name);
        showToast('Local Folder Linked', `FlowDesk mapped to local folder: ${result.name}`, 'success');
      }
    } catch {
      showToast('Error', 'Could not access selected folder.', 'error');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-[#141816] border border-[#176B5B]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[#176B5B]/20 border border-[#176B5B]/40 text-[#43D6B0] shrink-0 mt-0.5">
          {folderName ? <FolderCheck className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#F5F5F0]">
              {folderName ? `Local Storage Folder: ${folderName}` : 'Local-Device Storage Active'}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#176B5B]/20 text-[#43D6B0] border border-[#176B5B]/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Zero Cloud Quota
            </span>
          </div>
          <p className="text-[#A6B4AE] text-[11px] leading-relaxed">
            Your source files remain privately stored on your local disk. Clients receive deliverables only when you explicitly submit them.
          </p>
        </div>
      </div>

      {supported && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSelectFolder}
          disabled={connecting}
          className="shrink-0"
          leftIcon={<FolderCheck className="w-3.5 h-3.5" />}
        >
          {connecting ? 'Connecting...' : folderName ? 'Change Folder' : 'Link Local Folder'}
        </Button>
      )}
    </div>
  );
};

