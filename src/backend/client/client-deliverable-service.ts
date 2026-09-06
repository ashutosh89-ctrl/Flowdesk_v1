import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { Deliverable } from '@/shared/types';
import { mockClients, mockDeliverables } from '@/backend/store/mockData';
import { StorageHelper } from '@/backend/storage/storage-helper';

const CLIENT_SESSION_KEY = 'flowdesk_client_session';

export const ClientDeliverableService = {
  /**
   * Retrieves deliverables strictly scoped to the authenticated client
   */
  getDeliverables: async (clientId: string): Promise<Deliverable[]> => {
    if (!clientId) return [];

    // Demo mode: return mock data
    if (isDemoModeActive()) {
      return mockDeliverables.filter((d) => d.clientId === clientId);
    }

    try {
      const { data, error } = await supabase
        .from('deliverables')
        .select('*')
        .eq('client_id', clientId)
        .neq('status', 'archived')
        .order('due_date', { ascending: true });

      if (error) {
        console.warn('Error fetching client deliverables:', error.message);
        return [];
      }

      if (data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          projectId: d.project_id || '',
          clientId: d.client_id,
          clientName: d.client_name || '',
          title: d.title,
          description: d.description || '',
          status: d.status || 'draft',
          approvalStatus: d.approval_status || 'pending',
          priority: d.priority || 'medium',
          dueDate: d.due_date || new Date().toISOString().split('T')[0],
          reviewDeadline: d.review_deadline || undefined,
          version: d.current_version || 'v1.0',
          submissionMessage: d.submission_message || '',
          rejectionReason: d.rejection_reason || undefined,
          commentsCount: d.comments_count || 0,
          filesCount: d.files_count || 0,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (err) {
      console.warn('Error fetching client deliverables:', err);
    }

    return [];
  },

  /**
   * Get a single deliverable by ID with related data (versions, files, comments)
   */
  getDeliverableById: async (deliverableId: string, clientId: string): Promise<Deliverable | undefined> => {
    if (!deliverableId || !clientId) return undefined;

    // Demo mode
    if (isDemoModeActive()) {
      return mockDeliverables.find((d) => d.id === deliverableId && d.clientId === clientId);
    }

    try {
      const { data, error } = await supabase
        .from('deliverables')
        .select('*')
        .eq('id', deliverableId)
        .eq('client_id', clientId)
        .single();

      if (error || !data) return undefined;

      // Fetch related data (versions, files, non-internal comments)
      const [versionsResult, filesResult, commentsResult] = await Promise.all([
        supabase.from('deliverable_versions').select('*').eq('deliverable_id', deliverableId).order('created_at', { ascending: false }),
        supabase.from('deliverable_files').select('*').eq('deliverable_id', deliverableId),
        supabase.from('deliverable_comments').select('*').eq('deliverable_id', deliverableId).eq('is_internal', false).order('created_at', { ascending: true }),
      ]);

      const versions = await Promise.all((versionsResult.data || []).map(async (v: any) => ({
        id: v.id,
        deliverableId: v.deliverable_id,
        version: v.version_number,
        versionNumber: v.version_number,
        date: v.created_at?.split('T')[0] || '',
        note: v.note || '',
        fileUrl: v.file_url ? await StorageHelper.getDownloadUrl('deliverables', v.file_url) : '',
        fileName: v.file_name || '',
        fileSize: v.file_size || '',
        uploadedBy: v.uploaded_by || '',
        isArchived: Boolean(v.archived),
        isCurrentVersion: v.version_number === data.current_version,
      })));

      const files = await Promise.all((filesResult.data || []).map(async (f: any) => ({
        id: f.id,
        deliverableId: f.deliverable_id,
        fileName: f.file_name || '',
        fileSize: f.file_size || '',
        fileType: f.file_type || '',
        fileUrl: f.file_url ? await StorageHelper.getDownloadUrl('deliverables', f.file_url) : '',
        uploadedAt: f.uploaded_at?.split('T')[0] || f.created_at?.split('T')[0] || '',
        uploadedBy: f.uploaded_by || '',
        isPinned: Boolean(f.is_pinned),
      })));

      const comments = (commentsResult.data || []).map((c: any) => ({
        id: c.id,
        deliverableId: c.deliverable_id,
        author: c.author || 'User',
        authorRole: c.author_role || 'freelancer',
        isInternal: Boolean(c.is_internal),
        timestamp: c.created_at?.split('T')[0] || '',
        content: c.content || '',
        attachments: c.attachments || [],
        isResolved: Boolean(c.resolved),
      }));

      return {
        id: data.id,
        projectId: data.project_id || '',
        clientId: data.client_id,
        clientName: data.client_name || '',
        title: data.title,
        description: data.description || '',
        status: data.status || 'draft',
        approvalStatus: data.approval_status || 'pending',
        priority: data.priority || 'medium',
        dueDate: data.due_date || '',
        reviewDeadline: data.review_deadline || undefined,
        version: data.current_version || 'v1.0',
        submissionMessage: data.submission_message || '',
        rejectionReason: data.rejection_reason || undefined,
        files,
        versionHistory: versions,
        comments,
        commentsCount: data.comments_count || comments.length,
        filesCount: data.files_count || files.length,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.warn('Error fetching client deliverable by ID:', err);
      return undefined;
    }
  },

  /**
   * Client signs off on a deliverable after verifying ownership
   */
  approveDeliverable: async (
    clientId: string,
    deliverableId: string,
    notes?: string
  ): Promise<{ success: boolean; deliverable?: Deliverable; error?: string }> => {
    if (!clientId || !deliverableId) {
      return { success: false, error: 'Unauthorized deliverable sign-off request.' };
    }

    // Demo mode
    if (isDemoModeActive()) {
      const deliverable = mockDeliverables.find((d) => d.id === deliverableId && d.clientId === clientId);
      if (!deliverable) return { success: false, error: 'Deliverable not found.' };
      return { success: true, deliverable: { ...deliverable, status: 'approved', approvalStatus: 'approved' } };
    }

    try {
      // 1. Verify that deliverable belongs to this client
      const { data: existing, error: fetchError } = await supabase
        .from('deliverables')
        .select('id, client_id, status, title')
        .eq('id', deliverableId)
        .eq('client_id', clientId)
        .maybeSingle();

      if (fetchError || !existing) {
        return { success: false, error: 'Deliverable not found or does not belong to your account.' };
      }

      // 2. Validate status transition
      if (existing.status !== 'submitted') {
        return { success: false, error: `Cannot approve deliverable: current status is '${existing.status}'. Only submitted deliverables can be approved.` };
      }

      // 3. Perform the approval
      const { data: updated, error } = await supabase
        .from('deliverables')
        .update({
          status: 'approved',
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deliverableId)
        .eq('client_id', clientId)
        .select()
        .single();

      if (error || !updated) {
        return { success: false, error: 'Failed to approve deliverable.' };
      }

      // 4. Log activity
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).maybeSingle();
        const clientName = profile?.full_name || user?.email?.split('@')[0] || 'Client';

        await supabase.from('activities').insert({
          action: 'approved_deliverable',
          title: existing.title,
          description: notes || 'Deliverable approved',
          user_name: clientName,
          user_id: user?.id || null,
          resource_type: 'deliverable',
          resource_id: deliverableId,
        });
      } catch { /* non-critical */ }

      // 5. Create notification for freelancer
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).maybeSingle();
        const clientName = profile?.full_name || user?.email?.split('@')[0] || 'Client';

        // Get workspace_id from the deliverable
        const { data: deliverable } = await supabase.from('deliverables').select('workspace_id').eq('id', deliverableId).single();

        if (deliverable?.workspace_id) {
          // Get the workspace owner
          const { data: workspace } = await supabase.from('workspaces').select('owner_id').eq('id', deliverable.workspace_id).single();

          if (workspace?.owner_id) {
            await supabase.from('notifications').insert({
              workspace_id: deliverable.workspace_id,
              user_id: workspace.owner_id,
              title: 'Deliverable Approved',
              message: `${clientName} approved "${existing.title}"`,
              category: 'success',
              link: `/deliverables`,
            });

            // Dispatch transactional email to freelancer
            try {
              const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', workspace.owner_id).single();
              if (profile?.email) {
                const { EmailService, getAppBaseUrl } = await import('@/backend/email');
                await EmailService.sendDeliverableApproved(profile.email, {
                  freelancerName: profile.full_name || 'Freelancer',
                  clientName: clientName,
                  projectTitle: existing.title,
                  deliverableTitle: existing.title,
                  deliverableUrl: `${getAppBaseUrl()}/deliverables`,
                }, { workspaceId: deliverable.workspace_id, deliverableId });
              }
            } catch (emailErr) {
              console.warn('[ClientDeliverableService] Email dispatch notice (approval):', emailErr);
            }
          }
        }
      } catch { /* non-critical */ }

      // 6. Return updated deliverable
      return {
        success: true,
        deliverable: {
          id: updated.id,
          projectId: updated.project_id || '',
          clientId: updated.client_id,
          clientName: updated.client_name || '',
          title: updated.title,
          description: updated.description || '',
          status: updated.status,
          approvalStatus: updated.approval_status || 'approved',
          dueDate: updated.due_date || '',
          version: updated.current_version || 'v1.0',
        },
      };
    } catch (err) {
      console.warn('Deliverable approval error:', err);
      return { success: false, error: 'An unexpected error occurred during approval.' };
    }
  },

  /**
   * Client requests revisions on a deliverable after verifying ownership
   */
  requestRevision: async (
    clientId: string,
    deliverableId: string,
    revisionComment: string,
    attachmentFile?: File
  ): Promise<{ success: boolean; deliverable?: Deliverable; error?: string }> => {
    if (!clientId || !deliverableId) {
      return { success: false, error: 'Unauthorized revision request.' };
    }

    if (!revisionComment || !revisionComment.trim()) {
      return { success: false, error: 'Revision reason is required.' };
    }

    // Demo mode
    if (isDemoModeActive()) {
      const deliverable = mockDeliverables.find((d) => d.id === deliverableId && d.clientId === clientId);
      if (!deliverable) return { success: false, error: 'Deliverable not found.' };
      return { success: true, deliverable: { ...deliverable, status: 'revision_requested', approvalStatus: 'revision_requested', rejectionReason: revisionComment } };
    }

    try {
      // 1. Verify that deliverable belongs to this client
      const { data: existing, error: fetchError } = await supabase
        .from('deliverables')
        .select('id, client_id, status, title, workspace_id')
        .eq('id', deliverableId)
        .eq('client_id', clientId)
        .maybeSingle();

      if (fetchError || !existing) {
        return { success: false, error: 'Deliverable not found or does not belong to your account.' };
      }

      // 2. Validate status transition
      if (existing.status !== 'submitted') {
        return { success: false, error: `Cannot request revision: current status is '${existing.status}'. Only submitted deliverables can be revised.` };
      }

      // Handle optional file attachment upload
      let attachmentMetadata: { name: string; size: string; url: string } | null = null;
      if (attachmentFile && existing.workspace_id) {
        const uploadRes = await StorageHelper.uploadFile(
          'deliverables',
          existing.workspace_id,
          `revisions/${deliverableId}`,
          attachmentFile
        );
        if (!uploadRes.error && uploadRes.path) {
          attachmentMetadata = {
            name: attachmentFile.name,
            size: `${(attachmentFile.size / (1024 * 1024)).toFixed(1)} MB`,
            url: uploadRes.path,
          };
        }
      }

      // 3. Update the deliverable
      const { data: updated, error } = await supabase
        .from('deliverables')
        .update({
          status: 'revision_requested',
          approval_status: 'revision_requested',
          rejection_reason: revisionComment.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deliverableId)
        .eq('client_id', clientId)
        .select()
        .single();

      if (error || !updated) {
        return { success: false, error: 'Failed to request revision.' };
      }

      // 4. Store revision comment in deliverable_comments
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).maybeSingle();
        const clientName = profile?.full_name || user?.email?.split('@')[0] || 'Client';

        const commentPayload: any = {
          deliverable_id: deliverableId,
          author: clientName,
          author_id: user?.id || null,
          author_role: 'client',
          is_internal: false,
          content: `Revision requested: ${revisionComment.trim()}${attachmentMetadata ? ` (Attachment: ${attachmentMetadata.name})` : ''}`,
          resolved: false,
        };

        if (attachmentMetadata) {
          commentPayload.attachments = [attachmentMetadata];
        }

        await supabase.from('deliverable_comments').insert(commentPayload);
      } catch { /* non-critical */ }

      // 5. Log activity
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).maybeSingle();
        const clientName = profile?.full_name || user?.email?.split('@')[0] || 'Client';

        await supabase.from('activities').insert({
          workspace_id: existing.workspace_id,
          action: 'revision_requested',
          title: existing.title,
          description: revisionComment.trim(),
          user_name: clientName,
          user_id: user?.id || null,
          resource_type: 'deliverable',
          resource_id: deliverableId,
          client_id: clientId,
        });
      } catch { /* non-critical */ }

      // 6. Create notification for freelancer
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).maybeSingle();
        const clientName = profile?.full_name || user?.email?.split('@')[0] || 'Client';

        if (existing?.workspace_id) {
          const { data: workspace } = await supabase.from('workspaces').select('owner_id').eq('id', existing.workspace_id).single();

          if (workspace?.owner_id) {
            await supabase.from('notifications').insert({
              workspace_id: existing.workspace_id,
              user_id: workspace.owner_id,
              title: 'Revision Requested',
              message: `${clientName} requested revision on "${existing.title}": ${revisionComment.trim().substring(0, 100)}`,
              category: 'warning',
              link: `/deliverables`,
            });

            // Dispatch transactional email to freelancer
            try {
              const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', workspace.owner_id).single();
              if (profile?.email) {
                const { EmailService, getAppBaseUrl } = await import('@/backend/email');
                await EmailService.sendRevisionRequested(profile.email, {
                  freelancerName: profile.full_name || 'Freelancer',
                  clientName: clientName,
                  projectTitle: existing.title,
                  deliverableTitle: existing.title,
                  revisionNotes: revisionComment.trim(),
                  deliverableUrl: `${getAppBaseUrl()}/deliverables`,
                }, { workspaceId: existing.workspace_id, deliverableId });
              }
            } catch (emailErr) {
              console.warn('[ClientDeliverableService] Email dispatch notice (revision):', emailErr);
            }
          }
        }
      } catch { /* non-critical */ }

      // 7. Return updated deliverable
      return {
        success: true,
        deliverable: {
          id: updated.id,
          projectId: updated.project_id || '',
          clientId: updated.client_id,
          clientName: updated.client_name || '',
          title: updated.title,
          description: updated.description || '',
          status: updated.status,
          approvalStatus: updated.approval_status || 'revision_requested',
          rejectionReason: updated.rejection_reason || revisionComment,
          dueDate: updated.due_date || '',
          version: updated.current_version || 'v1.0',
        },
      };
    } catch (err) {
      console.warn('Deliverable revision request error:', err);
      return { success: false, error: 'An unexpected error occurred during revision request.' };
    }
  },

  /**
   * Add a comment on a deliverable from the client portal
   */
  addComment: async (
    clientId: string,
    deliverableId: string,
    content: string,
    authorName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!clientId || !deliverableId || !content?.trim()) {
      return { success: false, error: 'Missing required fields.' };
    }

    // Demo mode
    if (isDemoModeActive()) {
      return { success: true };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Verify deliverable belongs to client
      const { data: existing } = await supabase
        .from('deliverables')
        .select('id')
        .eq('id', deliverableId)
        .eq('client_id', clientId)
        .maybeSingle();

      if (!existing) {
        return { success: false, error: 'Deliverable not found.' };
      }

      const resolvedAuthor = authorName || user?.email?.split('@')[0] || 'Client';

      await supabase.from('deliverable_comments').insert({
        deliverable_id: deliverableId,
        author: resolvedAuthor,
        author_id: user?.id || null,
        author_role: 'client',
        is_internal: false,
        content: content.trim(),
        resolved: false,
      });

      // Update comments count
      const { count } = await supabase.from('deliverable_comments').select('*', { count: 'exact', head: true }).eq('deliverable_id', deliverableId);
      await supabase.from('deliverables').update({ comments_count: count || 0, updated_at: new Date().toISOString() }).eq('id', deliverableId);

      return { success: true };
    } catch (err) {
      console.warn('Error adding client comment:', err);
      return { success: false, error: 'Failed to add comment.' };
    }
  },
};
