import { supabase } from '@/backend/utilities/supabase';
import { Client } from '@/shared/types';

export const ClientRepository = {
  /**
   * Get all clients for a workspace
   */
  async getClients(workspaceId?: string): Promise<Client[]> {
    let query = supabase.from('clients').select('*');
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((c) => {
      let daysRemaining: number | undefined = undefined;
      let restoreUntil: string | undefined = undefined;
      if (c.deleted_at) {
        const delDate = new Date(c.deleted_at);
        const deadline = new Date(delDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        restoreUntil = deadline.toISOString().split('T')[0];
        daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      }

      return {
        id: c.id,
        userId: c.user_id,
        portalToken: c.portal_token,
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone || '',
        avatarUrl: c.avatar_url || '',
        status: c.status || 'active',
        healthBadge: c.health_badge || 'healthy',
        totalBilled: Number(c.total_billed) || 0,
        activeProjectsCount: c.active_projects_count || 0,
        country: c.country || 'India',
        currency: c.currency || 'USD',
        createdAt: c.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        deletedAt: c.deleted_at?.split('T')[0] || undefined,
        restoreUntil,
        daysRemaining,
      };
    });
  },

  /**
   * Get client by ID
   */
  async getClientById(id: string): Promise<Client | undefined> {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    if (!data) return undefined;

    let daysRemaining: number | undefined = undefined;
    let restoreUntil: string | undefined = undefined;
    if (data.deleted_at) {
      const delDate = new Date(data.deleted_at);
      const deadline = new Date(delDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      restoreUntil = deadline.toISOString().split('T')[0];
      daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }

    return {
      id: data.id,
      userId: data.user_id,
      portalToken: data.portal_token,
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone || '',
      avatarUrl: data.avatar_url || '',
      status: data.status || 'active',
      healthBadge: data.health_badge || 'healthy',
      totalBilled: Number(data.total_billed) || 0,
      activeProjectsCount: data.active_projects_count || 0,
      country: data.country || 'India',
      currency: data.currency || 'USD',
      createdAt: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      deletedAt: data.deleted_at?.split('T')[0] || undefined,
      restoreUntil,
      daysRemaining,
    };
  },

  /**
   * Create a new client
   */
  async createClient(clientData: Omit<Client, 'id' | 'totalBilled' | 'createdAt'>, workspaceId?: string): Promise<Client> {
    // Get workspace ID if not provided
    if (!workspaceId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).limit(1).single();
        workspaceId = ws?.id;
      }
    }

    // Check if client email already corresponds to a registered FlowDesk account
    let matchedUserId: string | null = null;
    if (clientData.email && clientData.email.includes('@')) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', clientData.email.trim().toLowerCase())
          .maybeSingle();
        if (prof?.id) {
          matchedUserId = prof.id;
        }
      } catch {}
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId || '',
        user_id: matchedUserId,
        name: clientData.name,
        company: clientData.company,
        email: clientData.email,
        phone: clientData.phone || '',
        avatar_url: clientData.avatarUrl || '',
        status: clientData.status || (matchedUserId ? 'active' : 'invited'),
        health_badge: clientData.healthBadge || 'healthy',
        active_projects_count: clientData.activeProjectsCount || 0,
        country: clientData.country || 'India',
        currency: clientData.currency || 'USD',
        notes: clientData.notes || '',
      })
      .select()
      .single();

    if (error || !data) throw new Error('Failed to create client');

    return {
      id: data.id,
      userId: data.user_id,
      portalToken: data.portal_token,
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone || '',
      avatarUrl: data.avatar_url || '',
      status: data.status || 'active',
      healthBadge: data.health_badge || 'healthy',
      totalBilled: Number(data.total_billed) || 0,
      activeProjectsCount: data.active_projects_count || 0,
      country: data.country || 'India',
      currency: data.currency || 'USD',
      createdAt: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    };
  },

  /**
   * Update a client
   */
  async updateClient(id: string, updates: Partial<Client>): Promise<Client | undefined> {
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.company !== undefined) payload.company = updates.company;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { error } = await supabase.from('clients').update(payload).eq('id', id);
    if (error) return undefined;

    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    if (!data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      portalToken: data.portal_token,
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone || '',
      avatarUrl: data.avatar_url || '',
      status: data.status || 'active',
      healthBadge: data.health_badge || 'healthy',
      totalBilled: Number(data.total_billed) || 0,
      activeProjectsCount: data.active_projects_count || 0,
      country: data.country || 'India',
      currency: data.currency || 'USD',
      createdAt: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    };
  },

  /**
   * Delete a client
   */
  async deleteClient(id: string): Promise<boolean> {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    return !error;
  },
};
