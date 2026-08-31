import { supabase } from '../../supabase';
import { StorageHelper } from '../../storage-helper';
import { getWorkspaceId } from '../../workspace';
import { ValidationError } from '../../errors';
import { DocumentItem } from '../../../types';

export const DocumentRepository = {
  async getDocuments(clientId?: string): Promise<DocumentItem[]> {
    const wsId = await getWorkspaceId();
    let query = supabase.from('documents').select('*').eq('workspace_id', wsId);
    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.warn('Error fetching documents:', error.message);
      return [];
    }

    return (data || []).map((d) => ({
      id: d.id,
      clientId: d.client_id,
      title: d.title,
      description: d.description || '',
      type: d.type || 'other',
      status: d.status || 'pending',
      isRequired: Boolean(d.is_required),
      dueDate: d.due_date || '',
      updatedAt: d.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      size: d.size || '1.2 MB',
      fileName: d.file_name || d.title,
      downloadUrl: StorageHelper.getPublicUrl('documents', d.file_url || ''),
    }));
  },

  async requestDocument(
    clientId: string,
    data: { title: string; type: DocumentItem['type']; isRequired?: boolean; dueDate?: string; description?: string }
  ): Promise<DocumentItem> {
    if (!clientId || !data.title) {
      throw new ValidationError('Client ID and document title are required.');
    }

    const wsId = await getWorkspaceId();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      workspace_id: wsId,
      client_id: clientId,
      user_id: user?.id || null,
      title: data.title,
      type: data.type,
      status: 'pending',
      is_required: data.isRequired ?? true,
      due_date: data.dueDate || new Date().toISOString().split('T')[0],
      description: data.description || '',
    };

    const { data: res, error } = await supabase.from('documents').insert(payload).select().single();
    if (error || !res) {
      throw new Error(`Failed to request document: ${error?.message || 'Database error'}`);
    }

    return {
      id: res.id,
      clientId: res.client_id,
      title: res.title,
      description: res.description,
      type: res.type,
      status: res.status,
      isRequired: res.is_required,
      dueDate: res.due_date,
      updatedAt: res.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      size: '1.2 MB',
    };
  },

  async deleteDocument(docId: string): Promise<boolean> {
    const wsId = await getWorkspaceId();

    // 1. Fetch document record to check storage file URL
    const { data: doc } = await supabase
      .from('documents')
      .select('file_url')
      .eq('id', docId)
      .eq('workspace_id', wsId)
      .single();

    // 2. Remove storage object if exists
    if (doc && doc.file_url) {
      await StorageHelper.deleteFile('documents', doc.file_url);
    }

    // 3. Delete database record
    const { error } = await supabase.from('documents').delete().eq('id', docId).eq('workspace_id', wsId);
    return !error;
  },
};
