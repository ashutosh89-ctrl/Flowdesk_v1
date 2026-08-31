import { supabase } from '../../supabase';
import { getWorkspaceId } from '../../workspace';
import { NotFoundError, ValidationError } from '../../errors';
import { Client } from '../../../types';

export const ClientRepository = {
  async getClients(): Promise<Client[]> {
    const wsId = await getWorkspaceId();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching clients:', error.message);
      return [];
    }

    return (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone || '',
      avatarUrl: c.avatar_url || '',
      status: c.status || 'active',
      healthBadge: c.health_badge || 'healthy',
      totalBilled: Number(c.total_billed) || 0,
      activeProjectsCount: c.active_projects_count || 0,
      country: c.country || 'United States',
      currency: c.currency || 'USD',
      createdAt: c.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      notes: c.notes || '',
    }));
  },

  async getClientById(id: string): Promise<Client | undefined> {
    const clients = await this.getClients();
    return clients.find((c) => c.id === id);
  },

  async createClient(clientData: Omit<Client, 'id' | 'totalBilled' | 'createdAt'>): Promise<Client> {
    if (!clientData.name || !clientData.company || !clientData.email) {
      throw new ValidationError('Name, company, and email are required to create a client.');
    }

    const wsId = await getWorkspaceId();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      workspace_id: wsId,
      user_id: user?.id || null,
      name: clientData.name,
      company: clientData.company,
      email: clientData.email,
      phone: clientData.phone || '',
      avatar_url: clientData.avatarUrl || '',
      status: clientData.status || 'active',
      health_badge: clientData.healthBadge || 'healthy',
      active_projects_count: clientData.activeProjectsCount || 1,
      total_billed: 0,
      country: clientData.country || 'United States',
      currency: clientData.currency || 'USD',
      notes: clientData.notes || '',
    };

    const { data, error } = await supabase.from('clients').insert(payload).select().single();
    if (error || !data) {
      throw new Error(`Failed to create client: ${error?.message || 'Database error'}`);
    }

    return {
      id: data.id,
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      status: data.status,
      healthBadge: data.health_badge,
      totalBilled: Number(data.total_billed),
      activeProjectsCount: data.active_projects_count,
      country: data.country,
      currency: data.currency,
      createdAt: data.created_at.split('T')[0],
      notes: data.notes,
    };
  },

  async updateClient(id: string, updates: Partial<Client>): Promise<Client | undefined> {
    const wsId = await getWorkspaceId();
    const payload: any = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.company !== undefined) payload.company = updates.company;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { error } = await supabase.from('clients').update(payload).eq('id', id).eq('workspace_id', wsId);
    if (error) {
      console.warn('Update client warning:', error.message);
    }
    return this.getClientById(id);
  },

  async deleteClient(id: string): Promise<boolean> {
    const wsId = await getWorkspaceId();
    const { error } = await supabase.from('clients').delete().eq('id', id).eq('workspace_id', wsId);
    return !error;
  },
};
