/**
-- ==============================================================================
-- FLOWDESK TYPED DATABASE DEFINITIONS (generated)
-- Generated via: npx supabase gen types typescript --local
-- Regenerate after any migration change; do not hand-edit.
-- ==============================================================================
*/


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "account_deletions": {
                  Row: {
                    "account_type": string,"client_company": string | null,"client_id": string | null,"client_name": string | null,"deleted_at": string | null,"deleted_by": string,"id": string,"metadata": Json | null,"restore_until": string,"status": string,"user_id": string | null,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_type": string,"client_company"?: string | null,"client_id"?: string | null,"client_name"?: string | null,"deleted_at"?: string | null,"deleted_by": string,"id"?: string,"metadata"?: Json | null,"restore_until": string,"status"?: string,"user_id"?: string | null,"workspace_id"?: string | null
                  }
                  Update: {
                    "account_type"?: string,"client_company"?: string | null,"client_id"?: string | null,"client_name"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string,"id"?: string,"metadata"?: Json | null,"restore_until"?: string,"status"?: string,"user_id"?: string | null,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_deletions_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_deletions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"activities": {
                  Row: {
                    "action": string,"client_id": string | null,"created_at": string | null,"description": string | null,"id": string,"metadata": Json | null,"project_id": string | null,"resource_id": string | null,"resource_type": string | null,"title": string,"user_name": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"client_id"?: string | null,"created_at"?: string | null,"description"?: string | null,"id"?: string,"metadata"?: Json | null,"project_id"?: string | null,"resource_id"?: string | null,"resource_type"?: string | null,"title": string,"user_name"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "action"?: string,"client_id"?: string | null,"created_at"?: string | null,"description"?: string | null,"id"?: string,"metadata"?: Json | null,"project_id"?: string | null,"resource_id"?: string | null,"resource_type"?: string | null,"title"?: string,"user_name"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_events": {
                  Row: {
                    "created_at": string | null,"event_type": string,"id": string,"payload": NonNullable<Json>,"provider": string,"provider_event_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"event_type": string,"id"?: string,"payload": NonNullable<Json>,"provider"?: string,"provider_event_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"event_type"?: string,"id"?: string,"payload"?: NonNullable<Json>,"provider"?: string,"provider_event_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"client_invitations": {
                  Row: {
                    "claimed_at": string | null,"claimed_by_user_id": string | null,"client_id": string,"created_at": string | null,"expires_at": string,"freelancer_id": string | null,"id": string,"recipient_email": string | null,"revoked_at": string | null,"status": string,"token_hash": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string | null,"claimed_by_user_id"?: string | null,"client_id": string,"created_at"?: string | null,"expires_at": string,"freelancer_id"?: string | null,"id"?: string,"recipient_email"?: string | null,"revoked_at"?: string | null,"status"?: string,"token_hash": string,"workspace_id": string
                  }
                  Update: {
                    "claimed_at"?: string | null,"claimed_by_user_id"?: string | null,"client_id"?: string,"created_at"?: string | null,"expires_at"?: string,"freelancer_id"?: string | null,"id"?: string,"recipient_email"?: string | null,"revoked_at"?: string | null,"status"?: string,"token_hash"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_invitations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_invitations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "active_projects_count": number | null,"avatar_url": string | null,"company": string,"country": string | null,"created_at": string | null,"currency": string | null,"deleted_at": string | null,"email": string,"health_badge": string | null,"id": string,"industry": string | null,"logo_url": string | null,"name": string,"notes": string | null,"phone": string | null,"portal_token": string | null,"status": string,"tags": (string)[] | null,"timezone": string | null,"total_billed": number | null,"updated_at": string | null,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_projects_count"?: number | null,"avatar_url"?: string | null,"company": string,"country"?: string | null,"created_at"?: string | null,"currency"?: string | null,"deleted_at"?: string | null,"email": string,"health_badge"?: string | null,"id"?: string,"industry"?: string | null,"logo_url"?: string | null,"name": string,"notes"?: string | null,"phone"?: string | null,"portal_token"?: string | null,"status"?: string,"tags"?: (string)[] | null,"timezone"?: string | null,"total_billed"?: number | null,"updated_at"?: string | null,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "active_projects_count"?: number | null,"avatar_url"?: string | null,"company"?: string,"country"?: string | null,"created_at"?: string | null,"currency"?: string | null,"deleted_at"?: string | null,"email"?: string,"health_badge"?: string | null,"id"?: string,"industry"?: string | null,"logo_url"?: string | null,"name"?: string,"notes"?: string | null,"phone"?: string | null,"portal_token"?: string | null,"status"?: string,"tags"?: (string)[] | null,"timezone"?: string | null,"total_billed"?: number | null,"updated_at"?: string | null,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"deliverable_comments": {
                  Row: {
                    "attachments": (string)[] | null,"author": string,"author_avatar": string | null,"author_id": string | null,"author_role": string | null,"content": string,"created_at": string | null,"deliverable_id": string,"id": string,"is_internal": boolean | null,"reply_to_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attachments"?: (string)[] | null,"author": string,"author_avatar"?: string | null,"author_id"?: string | null,"author_role"?: string | null,"content": string,"created_at"?: string | null,"deliverable_id": string,"id"?: string,"is_internal"?: boolean | null,"reply_to_id"?: string | null
                  }
                  Update: {
                    "attachments"?: (string)[] | null,"author"?: string,"author_avatar"?: string | null,"author_id"?: string | null,"author_role"?: string | null,"content"?: string,"created_at"?: string | null,"deliverable_id"?: string,"id"?: string,"is_internal"?: boolean | null,"reply_to_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "deliverable_comments_deliverable_id_fkey"
      columns: ["deliverable_id"]
isOneToOne: false
      referencedRelation: "deliverables"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deliverable_comments_reply_to_id_fkey"
      columns: ["reply_to_id"]
isOneToOne: false
      referencedRelation: "deliverable_comments"
      referencedColumns: ["id"]
    }
                  ]
                },"deliverable_files": {
                  Row: {
                    "created_at": string | null,"deliverable_id": string,"file_name": string,"file_size": string | null,"file_type": string | null,"file_url": string,"folder": string | null,"id": string,"is_pinned": boolean | null,"thumbnail_url": string | null,"uploaded_at": string | null,"uploaded_by": string | null,"version_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"deliverable_id": string,"file_name": string,"file_size"?: string | null,"file_type"?: string | null,"file_url": string,"folder"?: string | null,"id"?: string,"is_pinned"?: boolean | null,"thumbnail_url"?: string | null,"uploaded_at"?: string | null,"uploaded_by"?: string | null,"version_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"deliverable_id"?: string,"file_name"?: string,"file_size"?: string | null,"file_type"?: string | null,"file_url"?: string,"folder"?: string | null,"id"?: string,"is_pinned"?: boolean | null,"thumbnail_url"?: string | null,"uploaded_at"?: string | null,"uploaded_by"?: string | null,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "deliverable_files_deliverable_id_fkey"
      columns: ["deliverable_id"]
isOneToOne: false
      referencedRelation: "deliverables"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deliverable_files_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "deliverable_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"deliverable_versions": {
                  Row: {
                    "created_at": string | null,"deliverable_id": string,"file_name": string | null,"file_size": string | null,"file_url": string | null,"id": string,"note": string | null,"uploaded_by": string | null,"version_number": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"deliverable_id": string,"file_name"?: string | null,"file_size"?: string | null,"file_url"?: string | null,"id"?: string,"note"?: string | null,"uploaded_by"?: string | null,"version_number": string
                  }
                  Update: {
                    "created_at"?: string | null,"deliverable_id"?: string,"file_name"?: string | null,"file_size"?: string | null,"file_url"?: string | null,"id"?: string,"note"?: string | null,"uploaded_by"?: string | null,"version_number"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deliverable_versions_deliverable_id_fkey"
      columns: ["deliverable_id"]
isOneToOne: false
      referencedRelation: "deliverables"
      referencedColumns: ["id"]
    }
                  ]
                },"deliverables": {
                  Row: {
                    "approval_status": string | null,"approved_at": string | null,"client_id": string,"client_name": string | null,"comments_count": number | null,"created_at": string | null,"current_version": string | null,"description": string | null,"due_date": string | null,"files_count": number | null,"id": string,"internal_notes": string | null,"is_archived": boolean | null,"priority": string | null,"project_id": string | null,"rejection_reason": string | null,"review_deadline": string | null,"review_requested_at": string | null,"status": string,"submission_message": string | null,"submitted_at": string | null,"title": string,"updated_at": string | null,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_status"?: string | null,"approved_at"?: string | null,"client_id": string,"client_name"?: string | null,"comments_count"?: number | null,"created_at"?: string | null,"current_version"?: string | null,"description"?: string | null,"due_date"?: string | null,"files_count"?: number | null,"id"?: string,"internal_notes"?: string | null,"is_archived"?: boolean | null,"priority"?: string | null,"project_id"?: string | null,"rejection_reason"?: string | null,"review_deadline"?: string | null,"review_requested_at"?: string | null,"status"?: string,"submission_message"?: string | null,"submitted_at"?: string | null,"title": string,"updated_at"?: string | null,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "approval_status"?: string | null,"approved_at"?: string | null,"client_id"?: string,"client_name"?: string | null,"comments_count"?: number | null,"created_at"?: string | null,"current_version"?: string | null,"description"?: string | null,"due_date"?: string | null,"files_count"?: number | null,"id"?: string,"internal_notes"?: string | null,"is_archived"?: boolean | null,"priority"?: string | null,"project_id"?: string | null,"rejection_reason"?: string | null,"review_deadline"?: string | null,"review_requested_at"?: string | null,"status"?: string,"submission_message"?: string | null,"submitted_at"?: string | null,"title"?: string,"updated_at"?: string | null,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deliverables_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deliverables_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deliverables_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "category": string | null,"client_id": string | null,"created_at": string | null,"description": string | null,"download_url": string | null,"due_date": string | null,"file_name": string | null,"file_size": string | null,"file_url": string | null,"folder": string | null,"id": string,"is_internal": boolean | null,"is_pinned": boolean | null,"is_required": boolean | null,"mime_type": string | null,"project_id": string | null,"size": string | null,"status": string,"tags": (string)[] | null,"title": string,"type": string,"updated_at": string | null,"uploaded_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"client_id"?: string | null,"created_at"?: string | null,"description"?: string | null,"download_url"?: string | null,"due_date"?: string | null,"file_name"?: string | null,"file_size"?: string | null,"file_url"?: string | null,"folder"?: string | null,"id"?: string,"is_internal"?: boolean | null,"is_pinned"?: boolean | null,"is_required"?: boolean | null,"mime_type"?: string | null,"project_id"?: string | null,"size"?: string | null,"status"?: string,"tags"?: (string)[] | null,"title": string,"type"?: string,"updated_at"?: string | null,"uploaded_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "category"?: string | null,"client_id"?: string | null,"created_at"?: string | null,"description"?: string | null,"download_url"?: string | null,"due_date"?: string | null,"file_name"?: string | null,"file_size"?: string | null,"file_url"?: string | null,"folder"?: string | null,"id"?: string,"is_internal"?: boolean | null,"is_pinned"?: boolean | null,"is_required"?: boolean | null,"mime_type"?: string | null,"project_id"?: string | null,"size"?: string | null,"status"?: string,"tags"?: (string)[] | null,"title"?: string,"type"?: string,"updated_at"?: string | null,"uploaded_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"email_events": {
                  Row: {
                    "attempt_count": number | null,"claimed_at": string | null,"clicked_at": string | null,"created_at": string,"delivered_at": string | null,"event_type": string,"id": string,"last_error": string | null,"locked_by": string | null,"max_attempts": number | null,"next_attempt_at": string | null,"opened_at": string | null,"provider": string | null,"provider_message_id": string | null,"recipient": string,"reference_id": string | null,"reference_type": string | null,"sent_at": string | null,"status": string,"user_id": string | null,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_count"?: number | null,"claimed_at"?: string | null,"clicked_at"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"event_type": string,"id"?: string,"last_error"?: string | null,"locked_by"?: string | null,"max_attempts"?: number | null,"next_attempt_at"?: string | null,"opened_at"?: string | null,"provider"?: string | null,"provider_message_id"?: string | null,"recipient": string,"reference_id"?: string | null,"reference_type"?: string | null,"sent_at"?: string | null,"status"?: string,"user_id"?: string | null,"workspace_id"?: string | null
                  }
                  Update: {
                    "attempt_count"?: number | null,"claimed_at"?: string | null,"clicked_at"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"event_type"?: string,"id"?: string,"last_error"?: string | null,"locked_by"?: string | null,"max_attempts"?: number | null,"next_attempt_at"?: string | null,"opened_at"?: string | null,"provider"?: string | null,"provider_message_id"?: string | null,"recipient"?: string,"reference_id"?: string | null,"reference_type"?: string | null,"sent_at"?: string | null,"status"?: string,"user_id"?: string | null,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"entitlement_overrides": {
                  Row: {
                    "created_at": string | null,"expires_at": string | null,"feature": string,"id": string,"reason": string | null,"value": NonNullable<Json>,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"expires_at"?: string | null,"feature": string,"id"?: string,"reason"?: string | null,"value": NonNullable<Json>,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"expires_at"?: string | null,"feature"?: string,"id"?: string,"reason"?: string | null,"value"?: NonNullable<Json>,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlement_overrides_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_items": {
                  Row: {
                    "amount": number,"created_at": string | null,"description": string,"id": string,"invoice_id": string,"quantity": number,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number,"created_at"?: string | null,"description": string,"id"?: string,"invoice_id": string,"quantity"?: number,"unit_price"?: number
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string | null,"description"?: string,"id"?: string,"invoice_id"?: string,"quantity"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_payments": {
                  Row: {
                    "amount": number,"captured_at": string | null,"created_at": string | null,"currency": string,"failure_reason": string | null,"gateway": string | null,"gateway_status": string | null,"id": string,"invoice_id": string,"notes": string | null,"payment_date": string | null,"payment_method": string,"razorpay_order_id": string | null,"razorpay_payment_id": string | null,"razorpay_signature": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"captured_at"?: string | null,"created_at"?: string | null,"currency"?: string,"failure_reason"?: string | null,"gateway"?: string | null,"gateway_status"?: string | null,"id"?: string,"invoice_id": string,"notes"?: string | null,"payment_date"?: string | null,"payment_method"?: string,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"razorpay_signature"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "amount"?: number,"captured_at"?: string | null,"created_at"?: string | null,"currency"?: string,"failure_reason"?: string | null,"gateway"?: string | null,"gateway_status"?: string | null,"id"?: string,"invoice_id"?: string,"notes"?: string | null,"payment_date"?: string | null,"payment_method"?: string,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"razorpay_signature"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_payments_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "client_email": string | null,"client_id": string,"client_name": string | null,"created_at": string | null,"currency": string,"discount": number | null,"due_date": string,"id": string,"internal_notes": string | null,"invoice_number": string,"issue_date": string,"last_delivered_at": string | null,"notes": string | null,"paid_amount": number | null,"payment_instructions": string | null,"payment_status": string | null,"project_id": string | null,"project_name": string | null,"recurrence_period_key": string | null,"recurring_schedule_id": string | null,"status": string,"subtotal": number,"tax_amount": number | null,"tax_name": string | null,"tax_percentage": number | null,"total_amount": number,"updated_at": string | null,"user_id": string | null,"viewed_at": string | null,"workflow_status": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_email"?: string | null,"client_id": string,"client_name"?: string | null,"created_at"?: string | null,"currency"?: string,"discount"?: number | null,"due_date": string,"id"?: string,"internal_notes"?: string | null,"invoice_number": string,"issue_date": string,"last_delivered_at"?: string | null,"notes"?: string | null,"paid_amount"?: number | null,"payment_instructions"?: string | null,"payment_status"?: string | null,"project_id"?: string | null,"project_name"?: string | null,"recurrence_period_key"?: string | null,"recurring_schedule_id"?: string | null,"status"?: string,"subtotal"?: number,"tax_amount"?: number | null,"tax_name"?: string | null,"tax_percentage"?: number | null,"total_amount"?: number,"updated_at"?: string | null,"user_id"?: string | null,"viewed_at"?: string | null,"workflow_status"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "client_email"?: string | null,"client_id"?: string,"client_name"?: string | null,"created_at"?: string | null,"currency"?: string,"discount"?: number | null,"due_date"?: string,"id"?: string,"internal_notes"?: string | null,"invoice_number"?: string,"issue_date"?: string,"last_delivered_at"?: string | null,"notes"?: string | null,"paid_amount"?: number | null,"payment_instructions"?: string | null,"payment_status"?: string | null,"project_id"?: string | null,"project_name"?: string | null,"recurrence_period_key"?: string | null,"recurring_schedule_id"?: string | null,"status"?: string,"subtotal"?: number,"tax_amount"?: number | null,"tax_name"?: string | null,"tax_percentage"?: number | null,"total_amount"?: number,"updated_at"?: string | null,"user_id"?: string | null,"viewed_at"?: string | null,"workflow_status"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_recurring_schedule_id_fkey"
      columns: ["recurring_schedule_id"]
isOneToOne: false
      referencedRelation: "recurring_invoice_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"job_runs": {
                  Row: {
                    "attempt_number": number,"completed_at": string,"duration_ms": number | null,"error_message": string | null,"id": string,"job_id": string,"started_at": string,"status": string,"worker_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_number": number,"completed_at": string,"duration_ms"?: number | null,"error_message"?: string | null,"id"?: string,"job_id": string,"started_at": string,"status": string,"worker_id": string,"workspace_id": string
                  }
                  Update: {
                    "attempt_number"?: number,"completed_at"?: string,"duration_ms"?: number | null,"error_message"?: string | null,"id"?: string,"job_id"?: string,"started_at"?: string,"status"?: string,"worker_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_runs_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_runs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number | null,"created_at": string | null,"dedupe_key": string | null,"finished_at": string | null,"id": string,"last_error": string | null,"locked_by": string | null,"locked_until": string | null,"max_attempts": number | null,"payload": NonNullable<Json>,"run_at": string,"status": string,"type": string,"updated_at": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number | null,"created_at"?: string | null,"dedupe_key"?: string | null,"finished_at"?: string | null,"id"?: string,"last_error"?: string | null,"locked_by"?: string | null,"locked_until"?: string | null,"max_attempts"?: number | null,"payload"?: NonNullable<Json>,"run_at"?: string,"status"?: string,"type": string,"updated_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "attempts"?: number | null,"created_at"?: string | null,"dedupe_key"?: string | null,"finished_at"?: string | null,"id"?: string,"last_error"?: string | null,"locked_by"?: string | null,"locked_until"?: string | null,"max_attempts"?: number | null,"payload"?: NonNullable<Json>,"run_at"?: string,"status"?: string,"type"?: string,"updated_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "category": string | null,"client_id": string | null,"created_at": string | null,"id": string,"link": string | null,"message": string,"read": boolean | null,"title": string,"type": string | null,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"client_id"?: string | null,"created_at"?: string | null,"id"?: string,"link"?: string | null,"message": string,"read"?: boolean | null,"title": string,"type"?: string | null,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "category"?: string | null,"client_id"?: string | null,"created_at"?: string | null,"id"?: string,"link"?: string | null,"message"?: string,"read"?: boolean | null,"title"?: string,"type"?: string | null,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"business_name": string | null,"company_name": string | null,"country": string | null,"created_at": string | null,"currency": string | null,"deleted_at": string | null,"email": string | null,"full_name": string | null,"hourly_rate": number | null,"id": string,"language": string | null,"logo_url": string | null,"onboarding_completed": boolean | null,"phone": string | null,"profession": string | null,"signature_url": string | null,"status": string | null,"timezone": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"business_name"?: string | null,"company_name"?: string | null,"country"?: string | null,"created_at"?: string | null,"currency"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"hourly_rate"?: number | null,"id": string,"language"?: string | null,"logo_url"?: string | null,"onboarding_completed"?: boolean | null,"phone"?: string | null,"profession"?: string | null,"signature_url"?: string | null,"status"?: string | null,"timezone"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"business_name"?: string | null,"company_name"?: string | null,"country"?: string | null,"created_at"?: string | null,"currency"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"hourly_rate"?: number | null,"id"?: string,"language"?: string | null,"logo_url"?: string | null,"onboarding_completed"?: boolean | null,"phone"?: string | null,"profession"?: string | null,"signature_url"?: string | null,"status"?: string | null,"timezone"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"project_milestones": {
                  Row: {
                    "completed": boolean | null,"created_at": string | null,"description": string | null,"due_date": string | null,"id": string,"project_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed"?: boolean | null,"created_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"project_id": string,"title": string
                  }
                  Update: {
                    "completed"?: boolean | null,"created_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"project_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_milestones_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "budget": number | null,"client_id": string,"completion_percentage": number | null,"created_at": string | null,"description": string | null,"due_date": string | null,"id": string,"priority": string | null,"spent": number | null,"start_date": string | null,"status": string,"tags": (string)[] | null,"title": string,"updated_at": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget"?: number | null,"client_id": string,"completion_percentage"?: number | null,"created_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"priority"?: string | null,"spent"?: number | null,"start_date"?: string | null,"status"?: string,"tags"?: (string)[] | null,"title": string,"updated_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "budget"?: number | null,"client_id"?: string,"completion_percentage"?: number | null,"created_at"?: string | null,"description"?: string | null,"due_date"?: string | null,"id"?: string,"priority"?: string | null,"spent"?: number | null,"start_date"?: string | null,"status"?: string,"tags"?: (string)[] | null,"title"?: string,"updated_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"razorpay_orders": {
                  Row: {
                    "amount": number,"amount_subunits": number,"client_id": string,"created_at": string,"currency": string,"expires_at": string | null,"id": string,"invoice_id": string,"notes": Json | null,"order_id": string,"receipt": string,"status": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"amount_subunits": number,"client_id": string,"created_at"?: string,"currency": string,"expires_at"?: string | null,"id"?: string,"invoice_id": string,"notes"?: Json | null,"order_id": string,"receipt": string,"status"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "amount"?: number,"amount_subunits"?: number,"client_id"?: string,"created_at"?: string,"currency"?: string,"expires_at"?: string | null,"id"?: string,"invoice_id"?: string,"notes"?: Json | null,"order_id"?: string,"receipt"?: string,"status"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "razorpay_orders_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "razorpay_orders_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "razorpay_orders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"recurring_invoice_schedules": {
                  Row: {
                    "auto_send": boolean | null,"client_id": string,"created_at": string | null,"frequency": string,"id": string,"last_run_at": string | null,"next_run_at": string,"status": string,"template_data": NonNullable<Json>,"updated_at": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_send"?: boolean | null,"client_id": string,"created_at"?: string | null,"frequency": string,"id"?: string,"last_run_at"?: string | null,"next_run_at": string,"status"?: string,"template_data"?: NonNullable<Json>,"updated_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "auto_send"?: boolean | null,"client_id"?: string,"created_at"?: string | null,"frequency"?: string,"id"?: string,"last_run_at"?: string | null,"next_run_at"?: string,"status"?: string,"template_data"?: NonNullable<Json>,"updated_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_invoice_schedules_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_invoice_schedules_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"reminder_log": {
                  Row: {
                    "id": string,"invoice_id": string,"recipient_email": string,"rule_key": string,"sent_at": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"invoice_id": string,"recipient_email": string,"rule_key": string,"sent_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "id"?: string,"invoice_id"?: string,"recipient_email"?: string,"rule_key"?: string,"sent_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_log_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminder_log_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"reminder_settings": {
                  Row: {
                    "created_at": string | null,"enabled": boolean | null,"id": string,"rules": NonNullable<Json>,"updated_at": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"enabled"?: boolean | null,"id"?: string,"rules"?: NonNullable<Json>,"updated_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"enabled"?: boolean | null,"id"?: string,"rules"?: NonNullable<Json>,"updated_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_settings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean | null,"canceled_at": string | null,"created_at": string | null,"current_period_end": string | null,"current_period_start": string | null,"id": string,"plan_key": string,"razorpay_customer_id": string | null,"razorpay_subscription_id": string | null,"status": string,"updated_at": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean | null,"canceled_at"?: string | null,"created_at"?: string | null,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_key"?: string,"razorpay_customer_id"?: string | null,"razorpay_subscription_id"?: string | null,"status"?: string,"updated_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean | null,"canceled_at"?: string | null,"created_at"?: string | null,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_key"?: string,"razorpay_customer_id"?: string | null,"razorpay_subscription_id"?: string | null,"status"?: string,"updated_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_counters": {
                  Row: {
                    "id": string,"metric": string,"updated_at": string | null,"value": number | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"metric": string,"updated_at"?: string | null,"value"?: number | null,"workspace_id": string
                  }
                  Update: {
                    "id"?: string,"metric"?: string,"updated_at"?: string | null,"value"?: number | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_counters_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "comment_alerts": boolean | null,"created_at": string | null,"currency": string | null,"date_format": string | null,"default_payment_terms": number | null,"default_tax_rate": number | null,"email_deliverables": boolean | null,"email_documents": boolean | null,"email_invoices": boolean | null,"email_notifications": boolean | null,"id": string,"invoice_annual_reset": boolean | null,"invoice_include_year": boolean | null,"invoice_next_sequence": number | null,"invoice_number_format": string | null,"invoice_padding": number | null,"invoice_prefix": string | null,"invoice_reminders": boolean | null,"invoice_separator": string | null,"tax_name": string | null,"timezone": string | null,"updated_at": string | null,"week_start": string | null,"weekly_digest": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "comment_alerts"?: boolean | null,"created_at"?: string | null,"currency"?: string | null,"date_format"?: string | null,"default_payment_terms"?: number | null,"default_tax_rate"?: number | null,"email_deliverables"?: boolean | null,"email_documents"?: boolean | null,"email_invoices"?: boolean | null,"email_notifications"?: boolean | null,"id": string,"invoice_annual_reset"?: boolean | null,"invoice_include_year"?: boolean | null,"invoice_next_sequence"?: number | null,"invoice_number_format"?: string | null,"invoice_padding"?: number | null,"invoice_prefix"?: string | null,"invoice_reminders"?: boolean | null,"invoice_separator"?: string | null,"tax_name"?: string | null,"timezone"?: string | null,"updated_at"?: string | null,"week_start"?: string | null,"weekly_digest"?: boolean | null
                  }
                  Update: {
                    "comment_alerts"?: boolean | null,"created_at"?: string | null,"currency"?: string | null,"date_format"?: string | null,"default_payment_terms"?: number | null,"default_tax_rate"?: number | null,"email_deliverables"?: boolean | null,"email_documents"?: boolean | null,"email_invoices"?: boolean | null,"email_notifications"?: boolean | null,"id"?: string,"invoice_annual_reset"?: boolean | null,"invoice_include_year"?: boolean | null,"invoice_next_sequence"?: number | null,"invoice_number_format"?: string | null,"invoice_padding"?: number | null,"invoice_prefix"?: string | null,"invoice_reminders"?: boolean | null,"invoice_separator"?: string | null,"tax_name"?: string | null,"timezone"?: string | null,"updated_at"?: string | null,"week_start"?: string | null,"weekly_digest"?: boolean | null
                  }
                  Relationships: [
                    
                  ]
                },"workspace_comments": {
                  Row: {
                    "attachments": (string)[] | null,"author": string,"author_avatar": string | null,"author_role": string | null,"client_id": string,"created_at": string | null,"deliverable_id": string | null,"id": string,"is_internal": boolean | null,"is_owner": boolean | null,"is_pinned": boolean | null,"mentions": (string)[] | null,"project_id": string | null,"read_by_client": boolean | null,"reply_to_author": string | null,"reply_to_id": string | null,"reply_to_text": string | null,"text": string,"updated_at": string | null,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachments"?: (string)[] | null,"author": string,"author_avatar"?: string | null,"author_role"?: string | null,"client_id": string,"created_at"?: string | null,"deliverable_id"?: string | null,"id"?: string,"is_internal"?: boolean | null,"is_owner"?: boolean | null,"is_pinned"?: boolean | null,"mentions"?: (string)[] | null,"project_id"?: string | null,"read_by_client"?: boolean | null,"reply_to_author"?: string | null,"reply_to_id"?: string | null,"reply_to_text"?: string | null,"text": string,"updated_at"?: string | null,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "attachments"?: (string)[] | null,"author"?: string,"author_avatar"?: string | null,"author_role"?: string | null,"client_id"?: string,"created_at"?: string | null,"deliverable_id"?: string | null,"id"?: string,"is_internal"?: boolean | null,"is_owner"?: boolean | null,"is_pinned"?: boolean | null,"mentions"?: (string)[] | null,"project_id"?: string | null,"read_by_client"?: boolean | null,"reply_to_author"?: string | null,"reply_to_id"?: string | null,"reply_to_text"?: string | null,"text"?: string,"updated_at"?: string | null,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_comments_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_comments_deliverable_id_fkey"
      columns: ["deliverable_id"]
isOneToOne: false
      referencedRelation: "deliverables"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_comments_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_comments_reply_to_id_fkey"
      columns: ["reply_to_id"]
isOneToOne: false
      referencedRelation: "workspace_comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_comments_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string | null,"currency": string | null,"deleted_at": string | null,"id": string,"logo_url": string | null,"name": string,"owner_id": string,"signature_url": string | null,"status": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"currency"?: string | null,"deleted_at"?: string | null,"id"?: string,"logo_url"?: string | null,"name"?: string,"owner_id": string,"signature_url"?: string | null,"status"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"currency"?: string | null,"deleted_at"?: string | null,"id"?: string,"logo_url"?: string | null,"name"?: string,"owner_id"?: string,"signature_url"?: string | null,"status"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "get_auth_client_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"is_client_user":
{ Args: { "check_client_id": string }; Returns: boolean
                           },
"is_workspace_owner":
{ Args: { "check_workspace_id": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
