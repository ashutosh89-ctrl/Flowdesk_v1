/**
-- ==============================================================================
-- FLOWDESK TYPED DATABASE DEFINITIONS (TypeScript strict)
-- Matches Supabase PostgreSQL public schema
-- ==============================================================================
*/

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          logo_url: string | null;
          signature_url: string | null;
          business_name: string | null;
          company_name: string | null;
          profession: string | null;
          email: string | null;
          phone: string | null;
          country: string;
          timezone: string;
          language: string;
          currency: string;
          hourly_rate: number;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          logo_url?: string | null;
          signature_url?: string | null;
          business_name?: string | null;
          company_name?: string | null;
          profession?: string | null;
          email?: string | null;
          phone?: string | null;
          country?: string;
          timezone?: string;
          language?: string;
          currency?: string;
          hourly_rate?: number;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          logo_url?: string | null;
          signature_url?: string | null;
          business_name?: string | null;
          company_name?: string | null;
          profession?: string | null;
          email?: string | null;
          phone?: string | null;
          country?: string;
          timezone?: string;
          language?: string;
          currency?: string;
          hourly_rate?: number;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_settings: {
        Row: {
          id: string;
          currency: string;
          timezone: string;
          date_format: string;
          week_start: string;
          invoice_prefix: string;
          invoice_number_format: string;
          invoice_separator: string;
          invoice_include_year: boolean;
          invoice_padding: number;
          invoice_next_sequence: number;
          invoice_annual_reset: boolean;
          default_tax_rate: number;
          tax_name: string;
          default_payment_terms: number;
          email_notifications: boolean;
          email_deliverables: boolean;
          email_documents: boolean;
          email_invoices: boolean;
          invoice_reminders: boolean;
          comment_alerts: boolean;
          weekly_digest: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          currency?: string;
          timezone?: string;
          date_format?: string;
          week_start?: string;
          invoice_prefix?: string;
          invoice_number_format?: string;
          invoice_separator?: string;
          invoice_include_year?: boolean;
          invoice_padding?: number;
          invoice_next_sequence?: number;
          invoice_annual_reset?: boolean;
          default_tax_rate?: number;
          tax_name?: string;
          default_payment_terms?: number;
          email_notifications?: boolean;
          email_deliverables?: boolean;
          email_documents?: boolean;
          email_invoices?: boolean;
          invoice_reminders?: boolean;
          comment_alerts?: boolean;
          weekly_digest?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          currency?: string;
          timezone?: string;
          date_format?: string;
          week_start?: string;
          invoice_prefix?: string;
          invoice_number_format?: string;
          invoice_separator?: string;
          invoice_include_year?: boolean;
          invoice_padding?: number;
          invoice_next_sequence?: number;
          invoice_annual_reset?: boolean;
          default_tax_rate?: number;
          tax_name?: string;
          default_payment_terms?: number;
          email_notifications?: boolean;
          email_deliverables?: boolean;
          email_documents?: boolean;
          email_invoices?: boolean;
          invoice_reminders?: boolean;
          comment_alerts?: boolean;
          weekly_digest?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      workspaces: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          logo_url: string | null;
          signature_url: string | null;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name?: string;
          logo_url?: string | null;
          signature_url?: string | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          logo_url?: string | null;
          signature_url?: string | null;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          portal_token: string | null;
          name: string;
          company: string;
          email: string;
          phone: string | null;
          industry: string | null;
          avatar_url: string | null;
          logo_url: string | null;
          status: string;
          health_badge: string | null;
          total_billed: number;
          active_projects_count: number;
          country: string;
          timezone: string | null;
          currency: string;
          notes: string | null;
          tags: string[] | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          portal_token?: string | null;
          name: string;
          company: string;
          email: string;
          phone?: string | null;
          industry?: string | null;
          avatar_url?: string | null;
          logo_url?: string | null;
          status?: string;
          health_badge?: string | null;
          total_billed?: number;
          active_projects_count?: number;
          country?: string;
          timezone?: string | null;
          currency?: string;
          notes?: string | null;
          tags?: string[] | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string | null;
          portal_token?: string | null;
          name?: string;
          company?: string;
          email?: string;
          phone?: string | null;
          industry?: string | null;
          avatar_url?: string | null;
          logo_url?: string | null;
          status?: string;
          health_badge?: string | null;
          total_billed?: number;
          active_projects_count?: number;
          country?: string;
          timezone?: string | null;
          currency?: string;
          notes?: string | null;
          tags?: string[] | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      client_invitations: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          freelancer_id: string | null;
          token_hash: string;
          status: string;
          recipient_email: string | null;
          created_at: string;
          expires_at: string;
          claimed_at: string | null;
          claimed_by_user_id: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          freelancer_id?: string | null;
          token_hash: string;
          status?: string;
          recipient_email?: string | null;
          created_at?: string;
          expires_at: string;
          claimed_at?: string | null;
          claimed_by_user_id?: string | null;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          freelancer_id?: string | null;
          token_hash?: string;
          status?: string;
          recipient_email?: string | null;
          created_at?: string;
          expires_at?: string;
          claimed_at?: string | null;
          claimed_by_user_id?: string | null;
          revoked_at?: string | null;
        };
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          title: string;
          description: string | null;
          status: string;
          priority: string | null;
          budget: number;
          spent: number;
          start_date: string | null;
          due_date: string | null;
          completion_percentage: number;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string | null;
          budget?: number;
          spent?: number;
          start_date?: string | null;
          due_date?: string | null;
          completion_percentage?: number;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string | null;
          budget?: number;
          spent?: number;
          start_date?: string | null;
          due_date?: string | null;
          completion_percentage?: number;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      deliverables: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          project_id: string | null;
          title: string;
          description: string | null;
          status: string;
          approval_status: string | null;
          priority: string | null;
          due_date: string | null;
          review_deadline: string | null;
          current_version: string | null;
          submission_message: string | null;
          rejection_reason: string | null;
          files_count: number;
          comments_count: number;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          project_id?: string | null;
          title: string;
          description?: string | null;
          status?: string;
          approval_status?: string | null;
          priority?: string | null;
          due_date?: string | null;
          review_deadline?: string | null;
          current_version?: string | null;
          submission_message?: string | null;
          rejection_reason?: string | null;
          files_count?: number;
          comments_count?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          project_id?: string | null;
          title?: string;
          description?: string | null;
          status?: string;
          approval_status?: string | null;
          priority?: string | null;
          due_date?: string | null;
          review_deadline?: string | null;
          current_version?: string | null;
          submission_message?: string | null;
          rejection_reason?: string | null;
          files_count?: number;
          comments_count?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      deliverable_versions: {
        Row: {
          id: string;
          deliverable_id: string;
          version_number: string;
          note: string | null;
          file_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          deliverable_id: string;
          version_number: string;
          note?: string | null;
          file_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          deliverable_id?: string;
          version_number?: string;
          note?: string | null;
          file_url?: string | null;
          created_at?: string;
        };
      };
      deliverable_files: {
        Row: {
          id: string;
          deliverable_id: string;
          version_id: string | null;
          file_name: string;
          file_size: string | null;
          file_type: string | null;
          file_url: string;
          thumbnail_url: string | null;
          uploaded_by: string | null;
          uploaded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          deliverable_id: string;
          version_id?: string | null;
          file_name: string;
          file_size?: string | null;
          file_type?: string | null;
          file_url: string;
          thumbnail_url?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          deliverable_id?: string;
          version_id?: string | null;
          file_name?: string;
          file_size?: string | null;
          file_type?: string | null;
          file_url?: string;
          thumbnail_url?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          created_at?: string;
        };
      };
      deliverable_comments: {
        Row: {
          id: string;
          deliverable_id: string;
          author: string;
          author_avatar: string | null;
          author_role: string;
          is_internal: boolean;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          deliverable_id: string;
          author: string;
          author_avatar?: string | null;
          author_role?: string;
          is_internal?: boolean;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          deliverable_id?: string;
          author?: string;
          author_avatar?: string | null;
          author_role?: string;
          is_internal?: boolean;
          content?: string;
          created_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string | null;
          project_id: string | null;
          title: string;
          description: string | null;
          type: string;
          category: string | null;
          status: string;
          folder: string | null;
          is_pinned: boolean;
          is_internal: boolean;
          is_required: boolean;
          due_date: string | null;
          file_name: string | null;
          file_size: string | null;
          file_url: string | null;
          mime_type: string | null;
          tags: string[] | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id?: string | null;
          project_id?: string | null;
          title: string;
          description?: string | null;
          type?: string;
          category?: string | null;
          status?: string;
          folder?: string | null;
          is_pinned?: boolean;
          is_internal?: boolean;
          is_required?: boolean;
          due_date?: string | null;
          file_name?: string | null;
          file_size?: string | null;
          file_url?: string | null;
          mime_type?: string | null;
          tags?: string[] | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string | null;
          project_id?: string | null;
          title?: string;
          description?: string | null;
          type?: string;
          category?: string | null;
          status?: string;
          folder?: string | null;
          is_pinned?: boolean;
          is_internal?: boolean;
          is_required?: boolean;
          due_date?: string | null;
          file_name?: string | null;
          file_size?: string | null;
          file_url?: string | null;
          mime_type?: string | null;
          tags?: string[] | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          user_id: string | null;
          client_name: string | null;
          client_email: string | null;
          project_id: string | null;
          invoice_number: string;
          status: string;
          workflow_status: string;
          payment_status: string;
          issue_date: string;
          due_date: string;
          subtotal: number;
          tax_percentage: number;
          tax_name: string;
          tax_amount: number;
          total_amount: number;
          discount: number;
          paid_amount: number;
          currency: string;
          notes: string | null;
          payment_instructions: string | null;
          internal_notes: string | null;
          recurring_schedule_id: string | null;
          recurrence_period_key: string | null;
          viewed_at: string | null;
          last_delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          user_id?: string | null;
          client_name?: string | null;
          client_email?: string | null;
          project_id?: string | null;
          invoice_number: string;
          status?: string;
          workflow_status?: string;
          payment_status?: string;
          issue_date: string;
          due_date: string;
          subtotal?: number;
          tax_percentage?: number;
          tax_name?: string;
          tax_amount?: number;
          total_amount?: number;
          discount?: number;
          paid_amount?: number;
          currency?: string;
          notes?: string | null;
          payment_instructions?: string | null;
          internal_notes?: string | null;
          recurring_schedule_id?: string | null;
          recurrence_period_key?: string | null;
          viewed_at?: string | null;
          last_delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          user_id?: string | null;
          client_name?: string | null;
          client_email?: string | null;
          project_id?: string | null;
          invoice_number?: string;
          status?: string;
          workflow_status?: string;
          payment_status?: string;
          issue_date?: string;
          due_date?: string;
          subtotal?: number;
          tax_percentage?: number;
          tax_name?: string;
          tax_amount?: number;
          total_amount?: number;
          discount?: number;
          paid_amount?: number;
          currency?: string;
          notes?: string | null;
          payment_instructions?: string | null;
          internal_notes?: string | null;
          recurring_schedule_id?: string | null;
          recurrence_period_key?: string | null;
          viewed_at?: string | null;
          last_delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          created_at?: string;
        };
      };
      invoice_payments: {
        Row: {
          id: string;
          invoice_id: string;
          workspace_id: string;
          amount: number;
          currency: string;
          payment_method: string;
          payment_date: string;
          razorpay_payment_id: string | null;
          razorpay_order_id: string | null;
          razorpay_signature: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          workspace_id: string;
          amount: number;
          currency?: string;
          payment_method?: string;
          payment_date?: string;
          razorpay_payment_id?: string | null;
          razorpay_order_id?: string | null;
          razorpay_signature?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          workspace_id?: string;
          amount?: number;
          currency?: string;
          payment_method?: string;
          payment_date?: string;
          razorpay_payment_id?: string | null;
          razorpay_order_id?: string | null;
          razorpay_signature?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      workspace_comments: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          project_id: string | null;
          deliverable_id: string | null;
          author: string;
          author_avatar: string | null;
          author_role: string;
          text: string;
          is_owner: boolean;
          is_internal: boolean;
          reply_to_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          project_id?: string | null;
          deliverable_id?: string | null;
          author: string;
          author_avatar?: string | null;
          author_role?: string;
          text: string;
          is_owner?: boolean;
          is_internal?: boolean;
          reply_to_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          project_id?: string | null;
          deliverable_id?: string | null;
          author?: string;
          author_avatar?: string | null;
          author_role?: string;
          text?: string;
          is_owner?: boolean;
          is_internal?: boolean;
          reply_to_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      activities: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string | null;
          project_id: string | null;
          action: string;
          title: string;
          description: string | null;
          user_name: string | null;
          resource_type: string | null;
          resource_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id?: string | null;
          project_id?: string | null;
          action: string;
          title: string;
          description?: string | null;
          user_name?: string | null;
          resource_type?: string | null;
          resource_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string | null;
          project_id?: string | null;
          action?: string;
          title?: string;
          description?: string | null;
          user_name?: string | null;
          resource_type?: string | null;
          resource_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string | null;
          user_id: string;
          title: string;
          message: string;
          type: string;
          read: boolean;
          link: string | null;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id?: string | null;
          user_id: string;
          title: string;
          message: string;
          type?: string;
          read?: boolean;
          link?: string | null;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string | null;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string;
          read?: boolean;
          link?: string | null;
          category?: string | null;
          created_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          workspace_id: string;
          plan_key: string;
          status: string;
          razorpay_subscription_id: string | null;
          razorpay_customer_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          plan_key?: string;
          status?: string;
          razorpay_subscription_id?: string | null;
          razorpay_customer_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          plan_key?: string;
          status?: string;
          razorpay_subscription_id?: string | null;
          razorpay_customer_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      billing_events: {
        Row: {
          id: string;
          workspace_id: string;
          event_type: string;
          provider: string;
          provider_event_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          event_type: string;
          provider?: string;
          provider_event_id?: string | null;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          event_type?: string;
          provider?: string;
          provider_event_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
      };
      entitlement_overrides: {
        Row: {
          id: string;
          workspace_id: string;
          feature: string;
          value: Json;
          reason: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          feature: string;
          value: Json;
          reason?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          feature?: string;
          value?: Json;
          reason?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
      };
      usage_counters: {
        Row: {
          id: string;
          workspace_id: string;
          metric: string;
          value: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          metric: string;
          value?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          metric?: string;
          value?: number;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          type: string;
          workspace_id: string;
          payload: Json;
          status: string;
          run_at: string;
          attempts: number;
          max_attempts: number;
          locked_by: string | null;
          locked_until: string | null;
          last_error: string | null;
          dedupe_key: string | null;
          created_at: string;
          updated_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          type: string;
          workspace_id: string;
          payload?: Json;
          status?: string;
          run_at?: string;
          attempts?: number;
          max_attempts?: number;
          locked_by?: string | null;
          locked_until?: string | null;
          last_error?: string | null;
          dedupe_key?: string | null;
          created_at?: string;
          updated_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          type?: string;
          workspace_id?: string;
          payload?: Json;
          status?: string;
          run_at?: string;
          attempts?: number;
          max_attempts?: number;
          locked_by?: string | null;
          locked_until?: string | null;
          last_error?: string | null;
          dedupe_key?: string | null;
          created_at?: string;
          updated_at?: string;
          finished_at?: string | null;
        };
      };
      job_runs: {
        Row: {
          id: string;
          job_id: string;
          workspace_id: string;
          attempt_number: number;
          status: string;
          worker_id: string;
          duration_ms: number;
          error_message: string | null;
          started_at: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          workspace_id: string;
          attempt_number: number;
          status: string;
          worker_id: string;
          duration_ms?: number;
          error_message?: string | null;
          started_at: string;
          completed_at: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          workspace_id?: string;
          attempt_number?: number;
          status?: string;
          worker_id?: string;
          duration_ms?: number;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string;
        };
      };
      recurring_invoice_schedules: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          frequency: string;
          next_run_at: string;
          last_run_at: string | null;
          status: string;
          auto_send: boolean;
          template_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          frequency: string;
          next_run_at: string;
          last_run_at?: string | null;
          status?: string;
          auto_send?: boolean;
          template_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          frequency?: string;
          next_run_at?: string;
          last_run_at?: string | null;
          status?: string;
          auto_send?: boolean;
          template_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      reminder_settings: {
        Row: {
          id: string;
          workspace_id: string;
          enabled: boolean;
          rules: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          enabled?: boolean;
          rules?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          enabled?: boolean;
          rules?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      reminder_log: {
        Row: {
          id: string;
          workspace_id: string;
          invoice_id: string;
          rule_key: string;
          recipient_email: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          invoice_id: string;
          rule_key: string;
          recipient_email: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          invoice_id?: string;
          rule_key?: string;
          recipient_email?: string;
          sent_at?: string;
        };
      };
      account_deletions: {
        Row: {
          id: string;
          account_type: string;
          user_id: string | null;
          workspace_id: string | null;
          client_id: string | null;
          client_name: string | null;
          client_company: string | null;
          deleted_by: string;
          deleted_at: string;
          restore_until: string;
          status: string;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          account_type: string;
          user_id?: string | null;
          workspace_id?: string | null;
          client_id?: string | null;
          client_name?: string | null;
          client_company?: string | null;
          deleted_by: string;
          deleted_at?: string;
          restore_until: string;
          status?: string;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          account_type?: string;
          user_id?: string | null;
          workspace_id?: string | null;
          client_id?: string | null;
          client_name?: string | null;
          client_company?: string | null;
          deleted_by?: string;
          deleted_at?: string;
          restore_until?: string;
          status?: string;
          metadata?: Json | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_workspace_owner: {
        Args: { check_workspace_id: string };
        Returns: boolean;
      };
      get_auth_client_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      is_client_user: {
        Args: { check_client_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
