import { supabase } from '../../supabase';
import { getWorkspaceId } from '../../workspace';
import { ValidationError } from '../../errors';
import { Project } from '../../../types';

export const ProjectRepository = {
  async getProjects(): Promise<Project[]> {
    const wsId = await getWorkspaceId();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching projects:', error.message);
      return [];
    }

    return (data || []).map((p) => ({
      id: p.id,
      clientId: p.client_id,
      clientName: p.client_name || 'Client Workspace',
      title: p.title,
      description: p.description || '',
      status: p.status || 'in_progress',
      budget: Number(p.budget) || 0,
      spent: Number(p.spent) || 0,
      startDate: p.start_date || new Date().toISOString().split('T')[0],
      dueDate: p.due_date || new Date().toISOString().split('T')[0],
      completionPercentage: p.completion_percentage || 0,
      tags: p.tags || ['Design System'],
      milestones: p.milestones || [],
    }));
  },

  async getProjectsByClientId(clientId: string): Promise<Project[]> {
    const projs = await this.getProjects();
    return projs.filter((p) => p.clientId === clientId);
  },

  async getProjectById(id: string): Promise<Project | undefined> {
    const projs = await this.getProjects();
    return projs.find((p) => p.id === id);
  },

  async createProject(projectData: Omit<Project, 'id' | 'completionPercentage' | 'spent'>): Promise<Project> {
    if (!projectData.title || !projectData.clientId) {
      throw new ValidationError('Project title and client are required.');
    }

    const wsId = await getWorkspaceId();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      workspace_id: wsId,
      client_id: projectData.clientId,
      user_id: user?.id || null,
      client_name: projectData.clientName,
      title: projectData.title,
      description: projectData.description,
      status: projectData.status || 'in_progress',
      budget: projectData.budget || 0,
      spent: 0,
      completion_percentage: 0,
      start_date: projectData.startDate,
      due_date: projectData.dueDate,
      tags: projectData.tags || [],
      milestones: JSON.stringify(projectData.milestones || []),
    };

    const { data, error } = await supabase.from('projects').insert(payload).select().single();
    if (error || !data) {
      throw new Error(`Failed to create project: ${error?.message || 'Database error'}`);
    }

    return {
      id: data.id,
      clientId: data.client_id,
      clientName: data.client_name,
      title: data.title,
      description: data.description,
      status: data.status,
      budget: Number(data.budget),
      spent: Number(data.spent),
      startDate: data.start_date,
      dueDate: data.due_date,
      completionPercentage: data.completion_percentage,
      tags: data.tags || [],
      milestones: data.milestones || [],
    };
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const wsId = await getWorkspaceId();
    const payload: any = { updated_at: new Date().toISOString() };

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.budget !== undefined) payload.budget = updates.budget;
    if (updates.completionPercentage !== undefined) payload.completion_percentage = updates.completionPercentage;
    if (updates.milestones !== undefined) payload.milestones = JSON.stringify(updates.milestones);

    await supabase.from('projects').update(payload).eq('id', id).eq('workspace_id', wsId);
    return this.getProjectById(id);
  },

  async deleteProject(id: string): Promise<boolean> {
    const wsId = await getWorkspaceId();
    const { error } = await supabase.from('projects').delete().eq('id', id).eq('workspace_id', wsId);
    return !error;
  },
};
