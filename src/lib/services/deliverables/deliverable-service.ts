import { supabase } from '../../supabase';
import { StorageHelper } from '../../storage-helper';
import { getWorkspaceId } from '../../workspace';
import { ValidationError } from '../../errors';
import { Deliverable } from '../../../types';

export const DeliverableRepository = {
  async getDeliverables(clientId?: string): Promise<Deliverable[]> {
    const wsId = await getWorkspaceId();
    let query = supabase.from('deliverables').select('*').eq('workspace_id', wsId);
    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.warn('Error fetching deliverables:', error.message);
      return [];
    }

    return (data || []).map((d) => ({
      id: d.id,
      projectId: d.project_id || 'proj-1',
      clientId: d.client_id,
      clientName: d.client_name || 'Client Workspace',
      title: d.title,
      description: d.description || '',
      status: d.status || 'draft',
      dueDate: d.due_date || new Date().toISOString().split('T')[0],
      version: d.current_version || 'v1.0',
      internalNotes: d.internal_notes || '',
    }));
  },

  async addDeliverable(delData: Omit<Deliverable, 'id'>): Promise<Deliverable> {
    if (!delData.clientId || !delData.title) {
      throw new ValidationError('Client ID and deliverable title are required.');
    }

    const wsId = await getWorkspaceId();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      workspace_id: wsId,
      client_id: delData.clientId,
      project_id: delData.projectId || null,
      user_id: user?.id || null,
      client_name: delData.clientName,
      title: delData.title,
      description: delData.description,
      status: delData.status || 'draft',
      due_date: delData.dueDate,
      current_version: delData.version || 'v1.0',
      internal_notes: delData.internalNotes || '',
    };

    const { data, error } = await supabase.from('deliverables').insert(payload).select().single();
    if (error || !data) {
      throw new Error(`Failed to add deliverable: ${error?.message || 'Database error'}`);
    }

    return {
      id: data.id,
      projectId: data.project_id,
      clientId: data.client_id,
      clientName: data.client_name,
      title: data.title,
      description: data.description,
      status: data.status,
      dueDate: data.due_date,
      version: data.current_version,
    };
  },

  async approveDeliverable(id: string, note?: string): Promise<Deliverable | undefined> {
    const wsId = await getWorkspaceId();
    await supabase
      .from('deliverables')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', wsId);

    const delivs = await this.getDeliverables();
    return delivs.find((d) => d.id === id);
  },

  async deleteDeliverable(id: string): Promise<boolean> {
    const wsId = await getWorkspaceId();

    // 1. Fetch file objects linked to this deliverable
    const { data: files } = await supabase.from('deliverable_files').select('file_url').eq('deliverable_id', id);
    if (files) {
      for (const f of files) {
        if (f.file_url) {
          await StorageHelper.deleteFile('deliverables', f.file_url);
        }
      }
    }

    // 2. Delete database record
    const { error } = await supabase.from('deliverables').delete().eq('id', id).eq('workspace_id', wsId);
    return !error;
  },
};
