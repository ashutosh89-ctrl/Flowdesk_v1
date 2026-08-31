import { supabase } from '../../supabase';
import { getWorkspaceId } from '../../workspace';
import { ValidationError } from '../../errors';
import { Invoice } from '../../../types';

export const InvoiceRepository = {
  async getInvoices(clientId?: string): Promise<Invoice[]> {
    const wsId = await getWorkspaceId();
    let query = supabase.from('invoices').select('*, invoice_items(*)').eq('workspace_id', wsId);
    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.warn('Error fetching invoices:', error.message);
      return [];
    }

    return (data || []).map((i) => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      clientId: i.client_id,
      clientName: i.client_name || 'Client Workspace',
      clientEmail: i.client_email || 'client@example.com',
      projectId: i.project_id || undefined,
      projectName: i.project_name || undefined,
      issueDate: i.issue_date,
      dueDate: i.due_date,
      workflowStatus: (i.status as any) || 'draft',
      paymentStatus: Number(i.paid_amount) >= Number(i.total_amount) ? 'paid' : 'pending',
      status: i.status || 'draft',
      items: (i.invoice_items || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity) || 1,
        rate: Number(item.unit_price) || 0,
        amount: Number(item.amount) || 0,
      })),
      subtotal: Number(i.subtotal) || 0,
      taxPercentage: Number(i.tax_percentage) || 10,
      tax: Number(i.tax_amount) || 0,
      total: Number(i.total_amount) || 0,
      currency: i.currency || 'USD',
      notes: i.notes || '',
    }));
  },

  async getInvoiceById(id: string): Promise<Invoice | undefined> {
    const invs = await this.getInvoices();
    return invs.find((i) => i.id === id);
  },

  async createInvoice(invoiceData: Partial<Invoice> & { clientId: string; items: any[] }): Promise<Invoice> {
    if (!invoiceData.clientId) {
      throw new ValidationError('Client selection is required to create an invoice.');
    }

    const wsId = await getWorkspaceId();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const subtotal = (invoiceData.items || []).reduce(
      (acc, it: any) => acc + (Number(it.rate || it.unitPrice || 0) * Number(it.quantity || 1)),
      0
    );
    const taxAmount = Math.round(subtotal * ((invoiceData.taxPercentage || 10) / 100));
    const totalAmount = subtotal + taxAmount;

    const payload = {
      workspace_id: wsId,
      client_id: invoiceData.clientId,
      user_id: user?.id || null,
      client_name: invoiceData.clientName || 'Client Workspace',
      client_email: invoiceData.clientEmail || 'client@example.com',
      project_id: invoiceData.projectId || null,
      project_name: invoiceData.projectName || null,
      invoice_number: invoiceData.invoiceNumber || `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
      status: invoiceData.status || 'draft',
      issue_date: invoiceData.issueDate || new Date().toISOString().split('T')[0],
      due_date: invoiceData.dueDate || new Date().toISOString().split('T')[0],
      subtotal,
      tax_percentage: invoiceData.taxPercentage || 10,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      paid_amount: 0,
      currency: invoiceData.currency || 'USD',
      notes: invoiceData.notes || '',
    };

    const { data: inv, error } = await supabase.from('invoices').insert(payload).select().single();
    if (error || !inv) {
      throw new Error(`Failed to create invoice: ${error?.message || 'Database error'}`);
    }

    if (invoiceData.items && invoiceData.items.length > 0) {
      const itemPayloads = invoiceData.items.map((it: any) => ({
        invoice_id: inv.id,
        description: it.description || 'Deliverable Service',
        quantity: it.quantity || 1,
        unit_price: it.rate || it.unitPrice || 0,
        amount: (it.quantity || 1) * (it.rate || it.unitPrice || 0),
      }));
      await supabase.from('invoice_items').insert(itemPayloads);
    }

    // Log Activity
    await supabase.from('activities').insert({
      workspace_id: wsId,
      user_id: user?.id || null,
      client_id: invoiceData.clientId,
      action: 'created_invoice',
      title: inv.invoice_number,
      description: `Created invoice ${inv.invoice_number} for $${totalAmount}`,
      user_name: user?.email?.split('@')[0] || 'User',
      resource_type: 'invoice',
      resource_id: inv.id,
    });

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      clientId: inv.client_id,
      clientName: inv.client_name,
      clientEmail: inv.client_email,
      issueDate: inv.issue_date,
      dueDate: inv.due_date,
      workflowStatus: 'draft',
      paymentStatus: 'pending',
      status: inv.status,
      items: invoiceData.items || [],
      subtotal,
      taxPercentage: inv.tax_percentage,
      tax: taxAmount,
      total: totalAmount,
      currency: inv.currency,
      notes: inv.notes,
    };
  },

  async markAsPaid(id: string): Promise<Invoice | undefined> {
    const wsId = await getWorkspaceId();
    const inv = await this.getInvoiceById(id);
    if (!inv) return undefined;

    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_amount: inv.total, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', wsId);

    await supabase.from('invoice_payments').insert({
      invoice_id: id,
      amount: inv.total,
      payment_method: 'bank_transfer',
      notes: 'Payment marked as paid',
    });

    return this.getInvoiceById(id);
  },

  async deleteInvoice(id: string): Promise<boolean> {
    const wsId = await getWorkspaceId();
    const { error } = await supabase.from('invoices').delete().eq('id', id).eq('workspace_id', wsId);
    return !error;
  },
};
