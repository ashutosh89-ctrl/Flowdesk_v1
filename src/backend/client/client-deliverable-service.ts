import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { Deliverable } from '@/shared/types';
import { mockClients, mockDeliverables } from '@/backend/store/mockData';
import { FlowDeskStore } from '@/backend/store/storage-store';
import { StorageHelper } from '@/backend/storage/storage-helper';
import { isServerMutationBatchEnabled } from '@/shared/config/feature-flags';
import { safeDeliverableUpdate, deriveApprovalStatus } from '@/backend/utilities/deliverables-db';

const CLIENT_SESSION_KEY = 'flowdesk_client_session';

export const ClientDeliverableService = {
  /**
   * Retrieves deliverables strictly scoped to the authenticated client
   */
  getDeliverables: async (clientId: string): Promise<Deliverable[]> => {
    if (!clientId) return [];

    // Demo mode: return mock data without internal notes
    if (isDemoModeActive()) {
      return FlowDeskStore.getDeliverables(clientId).map(({ internalNotes, ...rest }) => rest as Deliverable);
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
        return FlowDeskStore.getDeliverables(clientId).map(({ internalNotes, ...rest }) => rest as Deliverable);
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
          niche: d.niche || 'general',
          nicheMetadata: d.metadata || {},
          fileUrl: d.file_url || d.metadata?.fileUrl || undefined,
          fileName: d.file_name || d.metadata?.fileName || undefined,
          fileSize: d.file_size || d.metadata?.fileSize || undefined,
          previewImageUrl: d.preview_image_url || d.metadata?.previewImageUrl || undefined,
          thumbnailUrl: d.thumbnail_url || d.metadata?.thumbnailUrl || undefined,
          commentsCount: d.comments_count || 0,
          filesCount: d.files_count || 0,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (err) {
      console.warn('Error fetching client deliverables:', err);
      return FlowDeskStore.getDeliverables(clientId).map(({ internalNotes, ...rest }) => rest as Deliverable);
    }

    const localDeliverables = FlowDeskStore.getDeliverables(clientId);
    if (localDeliverables.length > 0) {
      return localDeliverables.map(({ internalNotes, ...rest }) => rest as Deliverable);
    }

    return [];
  },

  /**
   * Get a single deliverable by ID with related data (versions, files, comments)
   */
  getDeliverableById: async (deliverableId: string, clientId: string): Promise<Deliverable | undefined> => {
    if (!deliverableId || !clientId) return undefined;

    // Demo mode: strip internalNotes to prevent private freelancer note leakage
    if (isDemoModeActive()) {
      const raw = FlowDeskStore.getDeliverableById(deliverableId);
      if (!raw) return undefined;
      const { internalNotes, ...safe } = raw;
      return safe as Deliverable;
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
        niche: data.niche || 'general',
        nicheMetadata: data.metadata || {},
        fileUrl: data.file_url || data.metadata?.fileUrl || (files[0]?.fileUrl) || undefined,
        fileName: data.file_name || data.metadata?.fileName || (files[0]?.fileName) || undefined,
        fileSize: data.file_size || data.metadata?.fileSize || (files[0]?.fileSize) || undefined,
        previewImageUrl: data.preview_image_url || data.metadata?.previewImageUrl || undefined,
        thumbnailUrl: data.thumbnail_url || data.metadata?.thumbnailUrl || undefined,
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
      const updated = FlowDeskStore.approveDeliverable(deliverableId, notes);
      if (!updated) return { success: false, error: 'Deliverable not found.' };
      return { success: true, deliverable: updated };
    }

    // In browser environment, delegate to the hardened server Route Handler
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(`/api/deliverables/${encodeURIComponent(deliverableId)}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: notes || '' }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          return { success: false, error: data.error || 'Failed to approve deliverable.' };
        }
        return { success: true, deliverable: data.deliverable };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error while approving deliverable.' };
      }
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
      const { data: updated, error } = await safeDeliverableUpdate(
        supabase,
        deliverableId,
        {
          status: 'approved',
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { key: 'client_id', value: clientId }
      );

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
                const { EmailService } = await import('@/backend/email/email-service');
                const { getAppBaseUrl } = await import('@/shared/utils/url');
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
      const updated = FlowDeskStore.requestDeliverableRevision(deliverableId, revisionComment);
      if (!updated) return { success: false, error: 'Deliverable not found.' };
      return { success: true, deliverable: updated };
    }

    if (typeof window !== 'undefined' && isServerMutationBatchEnabled(2)) {
      try {
        const response = await fetch(`/api/deliverables/${encodeURIComponent(deliverableId)}/revision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revisionComment }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          return { success: false, error: data.error || 'Failed to request revision.' };
        }
        return { success: true, deliverable: data.deliverable };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error requesting revision.' };
      }
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
          'documents',
          existing.workspace_id,
          `revisions/${deliverableId}`,
          attachmentFile,
          { clientId }
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
      const { data: updated, error } = await safeDeliverableUpdate(
        supabase,
        deliverableId,
        {
          status: 'revision_requested',
          approval_status: 'revision_requested',
          rejection_reason: revisionComment.trim(),
          updated_at: new Date().toISOString(),
        },
        { key: 'client_id', value: clientId }
      );

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
                const { EmailService } = await import('@/backend/email/email-service');
                const { getAppBaseUrl } = await import('@/shared/utils/url');
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
      FlowDeskStore.addDeliverableComment(deliverableId, {
        author: authorName || 'Client',
        authorRole: 'client',
        isInternal: false,
        content: content.trim(),
      });
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

      // Update comments count (non-critical, ignore if column absent)
      try {
        const { count } = await supabase.from('deliverable_comments').select('*', { count: 'exact', head: true }).eq('deliverable_id', deliverableId);
        await supabase.from('deliverables').update({ comments_count: count || 0, updated_at: new Date().toISOString() }).eq('id', deliverableId);
      } catch {
        // Non-critical
      }

      return { success: true };
    } catch (err) {
      console.warn('Error adding client comment:', err);
      return { success: false, error: 'Failed to add comment.' };
    }
  },
};
