import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { StorageHelper } from '@/backend/storage/storage-helper';
import { DocumentItem } from '@/shared/types';
import { DemoDataProvider } from '@/backend/utilities/demo-data-provider';
import { FlowDeskStore } from '@/backend/store/storage-store';

export type DocumentCategory =
  | 'contract'
  | 'brief'
  | 'asset'
  | 'deliverable'
  | 'invoice'
  | 'proposal'
  | 'nda'
  | 'tax'
  | 'other';

const VALID_CATEGORIES: DocumentCategory[] = [
  'contract',
  'brief',
  'asset',
  'deliverable',
  'invoice',
  'proposal',
  'nda',
  'tax',
  'other',
];

export interface DirectUploadPayload {
  file: File;
  title: string;
  category: DocumentCategory;
  description?: string;
  projectId?: string;
  workspaceId?: string;
}

export const ClientDocumentService = {
  /**
   * Retrieves non-internal documents strictly scoped to the authenticated client
   */
  getDocuments: async (clientId: string): Promise<DocumentItem[]> => {
    if (!clientId) return [];
    // Demo mode: return mock data
    if (isDemoModeActive()) return DemoDataProvider.getDocuments(clientId);

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_internal', false)
        .order('updated_at', { ascending: false });

      if (data && data.length > 0) {
        return Promise.all(data.map(async (doc) => ({
          id: doc.id,
          clientId: doc.client_id,
          title: doc.title,
          description: doc.description || '',
          type: (doc.type as DocumentItem['type']) || 'other',
          status: doc.status || 'pending',
          isInternal: false,
          isRequired: Boolean(doc.is_required),
          dueDate: doc.due_date || '',
          updatedAt: doc.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          size: doc.size || '1.2 MB',
          fileName: doc.file_name || doc.title,
          downloadUrl: await StorageHelper.getDownloadUrl('documents', doc.file_url || ''),
        })));
      }
    } catch (err) {
      console.warn('Error fetching client documents from Supabase:', err);
    }

    return [];
  },

  /**
   * Fulfills an intake document upload request.
   * If a File object is provided, uploads to Supabase Storage.
   * Otherwise updates metadata only (backward compatible).
   */
  uploadDocumentFile: async (
    clientId: string,
    docId: string,
    fileData: { fileName: string; size: string; downloadUrl?: string; file?: File; workspaceId?: string }
  ): Promise<{ success: boolean; document?: DocumentItem; error?: string }> => {
    if (!clientId || !docId) {
      return { success: false, error: 'Unauthorized document upload request.' };
    }

    // Demo mode fallback
    if (isDemoModeActive()) {
      const updated = FlowDeskStore.uploadDocumentFile(docId, fileData);
      return { success: true, document: updated };
    }

    try {
      // 1. Verify document belongs to this client
      const { data: existing, error: existError } = await supabase
        .from('documents')
        .select('id, client_id, workspace_id, title')
        .eq('id', docId)
        .eq('client_id', clientId)
        .maybeSingle();

      if (existError || !existing) {
        return { success: false, error: 'Document request not found or does not belong to your account.' };
      }

      const wsId = fileData.workspaceId || existing.workspace_id || '';
      let fileUrl = '';

      // 2. Upload actual file to Supabase Storage if File object provided
      if (fileData.file && wsId) {
        const uploadResult = await StorageHelper.uploadFile(
          'documents',
          wsId,
          `documents/${docId}`,
          fileData.file
        );

        if (uploadResult.error || !uploadResult.path) {
          console.warn('Storage upload error:', uploadResult.error || 'No storage path returned');
        } else {
          fileUrl = uploadResult.path;
        }
      }

      // 3. Update document metadata in Supabase
      const updatePayload: any = {
        status: 'uploaded',
        file_name: fileData.fileName,
        size: fileData.size,
        updated_at: new Date().toISOString(),
      };

      if (fileUrl) {
        updatePayload.file_url = fileUrl;
        // Private bucket: store the storage path only; downloads resolve signed URLs.
        updatePayload.download_url = '';
      } else if (fileData.downloadUrl) {
        updatePayload.file_url = fileData.downloadUrl;
        updatePayload.download_url = fileData.downloadUrl;
      }

      const { data: updated, error } = await supabase
        .from('documents')
        .update(updatePayload)
        .eq('id', docId)
        .eq('client_id', clientId)
        .select()
        .single();

      if (error) {
        console.warn('Supabase document update error:', error.message);
        return { success: false, error: `Failed to save document metadata: ${error.message}` };
      }

      if (updated) {
        // Activity & Notification
        try {
          const { data: clientRec } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
          const clientName = clientRec?.name || 'Client';

          await supabase.from('activities').insert({
            workspace_id: wsId,
            client_id: clientId,
            action: 'document_uploaded',
            title: existing.title,
            description: `${clientName} fulfilled document request: "${existing.title}"`,
            resource_type: 'document',
            created_at: new Date().toISOString(),
          });

          const { NotificationHelper } = await import('@/backend/utilities/notification-helper');
          await NotificationHelper.clientDocumentUploaded(existing.title, clientName, 'Request Fulfilled');
        } catch (actErr) {
          console.warn('Activity logging notice:', actErr);
        }

        return {
          success: true,
          document: {
            id: updated.id,
            clientId: updated.client_id,
            title: updated.title,
            type: updated.type,
            status: updated.status,
            updatedAt: updated.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            size: updated.size || fileData.size,
            fileName: updated.file_name || fileData.fileName,
            downloadUrl: await StorageHelper.getDownloadUrl('documents', updated.file_url || ''),
          },
        };
      }
    } catch (err) {
      console.warn('Supabase document upload error:', err);
    }

    return { success: false, error: 'Document upload failed. Please try again.' };
  },

  /**
   * Direct Client Document Upload (New MVP Requirement)
   * Uploads a voluntary/direct document from the client portal into Supabase Storage
   * and inserts the metadata record into public.documents.
   */
  uploadDirectDocument: async (
    clientId: string,
    payload: DirectUploadPayload
  ): Promise<{ success: boolean; document?: DocumentItem; error?: string }> => {
    if (!clientId) {
      return { success: false, error: 'Authentication required. Missing client identifier.' };
    }
    if (!payload.file) {
      return { success: false, error: 'Please select a valid file to upload.' };
    }

    // Max 25MB validation
    const maxSizeBytes = 25 * 1024 * 1024;
    if (payload.file.size > maxSizeBytes) {
      return { success: false, error: 'File size exceeds maximum allowable limit (25MB).' };
    }

    // Validate category
    const normalizedCategory = (payload.category || 'other').toLowerCase() as DocumentCategory;
    const validatedCategory = VALID_CATEGORIES.includes(normalizedCategory) ? normalizedCategory : 'other';

    const documentTitle = payload.title?.trim() || payload.file.name.replace(/\.[^/.]+$/, '');

    // Format file size
    const formatSize = (bytes: number) => {
      if (!bytes || bytes <= 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };
    const formattedSize = formatSize(payload.file.size);

    // Demo mode support
    if (isDemoModeActive()) {
      const demoDoc = FlowDeskStore.uploadDirectDocument(clientId, {
        title: documentTitle,
        type: validatedCategory,
        description: payload.description,
        fileName: payload.file.name,
        size: formattedSize,
        projectId: payload.projectId,
      });
      return { success: true, document: demoDoc };
    }

    try {
      // 1. Resolve workspace_id from client record
      const { data: clientRec, error: clientErr } = await supabase
        .from('clients')
        .select('id, workspace_id, name')
        .eq('id', clientId)
        .maybeSingle();

      if (clientErr || !clientRec) {
        return { success: false, error: 'Client account could not be found or verified.' };
      }

      const wsId = payload.workspaceId || clientRec.workspace_id;
      if (!wsId) {
        return { success: false, error: 'No workspace associated with this client account.' };
      }

      // 2. Upload file to Supabase Storage
      const uploadResult = await StorageHelper.uploadFile(
        'documents',
        wsId,
        `documents/client-uploads`,
        payload.file
      );

      if (uploadResult.error || !uploadResult.path) {
        return { success: false, error: `Storage upload failed: ${uploadResult.error || 'No storage path returned'}` };
      }

      // 3. Insert metadata into public.documents
      const newDocRow: any = {
        workspace_id: wsId,
        client_id: clientId,
        title: documentTitle,
        type: validatedCategory,
        status: 'uploaded',
        is_internal: false,
        is_required: false,
        description: payload.description?.trim() || null,
        file_name: payload.file.name,
        size: formattedSize,
        file_url: uploadResult.path,
        download_url: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (payload.projectId) {
        newDocRow.project_id = payload.projectId;
      }

      const { data: inserted, error: dbError } = await supabase
        .from('documents')
        .insert(newDocRow)
        .select()
        .single();

      if (dbError) {
        // Rollback uploaded storage object to prevent orphans
        if (uploadResult.path && !uploadResult.path.startsWith('local/')) {
          await StorageHelper.deleteFile('documents', uploadResult.path);
        }
        return { success: false, error: `Failed to save document metadata: ${dbError.message}` };
      }

      // 4. Log Activity
      try {
        await supabase.from('activities').insert({
          workspace_id: wsId,
          client_id: clientId,
          action: 'document_uploaded',
          title: documentTitle,
          description: `${clientRec.name || 'Client'} uploaded document: "${documentTitle}"`,
          resource_type: 'document',
          created_at: new Date().toISOString(),
        });
      } catch (actErr) {
        console.warn('Activity logging notice:', actErr);
      }

      // 5. Trigger in-app notification & transactional email for freelancer
      try {
        const { NotificationHelper } = await import('@/backend/utilities/notification-helper');
        await NotificationHelper.clientDocumentUploaded(
          documentTitle,
          clientRec.name || 'Client',
          validatedCategory
        );

        const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', wsId).single();
        if (ws?.owner_id) {
          const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', ws.owner_id).single();
          if (profile?.email) {
            const { EmailService, getAppBaseUrl } = await import('@/backend/email');
            await EmailService.sendDocumentUploaded(profile.email, {
              recipientName: profile.full_name || 'Freelancer',
              uploaderName: clientRec.name || 'Client',
              documentTitle: documentTitle,
              category: validatedCategory,
              projectTitle: payload.projectId ? 'Project Document' : undefined,
              documentUrl: `${getAppBaseUrl()}/documents`,
            }, { workspaceId: wsId, documentId: inserted.id });
          }
        }
      } catch (notifErr) {
        console.warn('Notification/Email notice:', notifErr);
      }

      const clientDocItem: DocumentItem = {
        id: inserted.id,
        clientId: inserted.client_id,
        title: inserted.title,
        type: inserted.type,
        status: inserted.status,
        description: inserted.description || '',
        updatedAt: inserted.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        size: inserted.size || formattedSize,
        fileName: inserted.file_name || payload.file.name,
        downloadUrl: await StorageHelper.getDownloadUrl('documents', inserted.file_url || ''),
      };

      return { success: true, document: clientDocItem };
    } catch (err: any) {
      console.warn('Unexpected error during direct document upload:', err);
      return { success: false, error: err?.message || 'An unexpected error occurred during document upload.' };
    }
  },
};
