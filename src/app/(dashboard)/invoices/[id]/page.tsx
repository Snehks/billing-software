'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Printer, Plus, Copy, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Invoice, InvoiceItem, Payment, PAYMENT_MODES } from '@/lib/types'
import { ShareWhatsAppButton } from '@/components/share-whatsapp-button'

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_mode: 'Cash' as Payment['payment_mode'],
    reference_number: '',
    notes: '',
  })

  const fetchData = async () => {
    const [invoiceRes, itemsRes, paymentsRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', params.id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', params.id).order('serial_number'),
      supabase.from('payments').select('*').eq('invoice_id', params.id).order('payment_date', { ascending: false }),
    ])

    if (invoiceRes.data) setInvoice(invoiceRes.data)
    if (itemsRes.data) setItems(itemsRes.data)
    if (paymentsRes.data) setPayments(paymentsRes.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [params.id])

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const balance = (invoice?.grand_total || 0) - totalPaid
  const paymentStatus = balance <= 0 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid'

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.from('payments').insert({
      invoice_id: params.id,
      payment_date: paymentForm.payment_date,
      amount: parseFloat(paymentForm.amount),
      payment_mode: paymentForm.payment_mode,
      reference_number: paymentForm.reference_number || null,
      notes: paymentForm.notes || null,
    })

    if (error) {
      toast.error('Failed to add payment')
      return
    }

    toast.success('Payment added')
    setPaymentDialogOpen(false)
    setPaymentForm({
      payment_date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_mode: 'Cash',
      reference_number: '',
      notes: '',
    })
    fetchData()
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Delete this payment?')) return

    const { error } = await supabase.from('payments').delete().eq('id', paymentId)

    if (error) {
      toast.error('Failed to delete payment')
      return
    }

    toast.success('Payment deleted')
    fetchData()
  }

  const handleDuplicate = async () => {
    if (!invoice) return

    // Get next invoice number
    const { data: settings } = await supabase
      .from('company_settings')
      .select('next_invoice_number')
      .eq('id', 1)
      .single()

    const nextNumber = settings?.next_invoice_number || 1

    // Create new invoice
    const { data: newInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        ...invoice,
        id: undefined,
        invoice_number: nextNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        created_at: undefined,
        updated_at: undefined,
      })
      .select()
      .single()

    if (invoiceError) {
      toast.error('Failed to duplicate invoice')
      return
    }

    // Copy line items
    const newItems = items.map(item => ({
      ...item,
      id: undefined,
      invoice_id: newInvoice.id,
      created_at: undefined,
    }))

    await supabase.from('invoice_items').insert(newItems)

    // Update next invoice number
    await supabase
      .from('company_settings')
      .update({ next_invoice_number: nextNumber + 1 })
      .eq('id', 1)

    toast.success('Invoice duplicated')
    router.push(`/invoices/${newInvoice.id}`)
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!invoice) return <div className="p-8">Invoice not found</div>

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/invoices')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Invoice #{invoice.invoice_number}</h1>
          <Badge variant={paymentStatus === 'Paid' ? 'default' : paymentStatus === 'Partial' ? 'secondary' : 'destructive'}>
            {paymentStatus}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/invoices/${invoice.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <ShareWhatsAppButton
            invoiceNumber={invoice.invoice_number}
            partyName={invoice.billed_to_name}
            grandTotal={invoice.grand_total}
            partyPhone={invoice.shipped_to_phone}
            invoiceId={invoice.id}
          />
          <Button onClick={() => window.open(`/print/${invoice.id}`, '_blank')}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Invoice Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Date</p>
                <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
              </div>
              <div>
                <p className="text-slate-500">Party</p>
                <p className="font-medium">{invoice.billed_to_name}</p>
              </div>
              <div>
                <p className="text-slate-500">GSTIN</p>
                <p className="font-medium">{invoice.party_gstin || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Place of Supply</p>
                <p className="font-medium">{invoice.place_of_supply || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Transport</p>
                <p className="font-medium">{invoice.transport_mode || '-'} {invoice.vehicle_number || ''}</p>
              </div>
              <div>
                <p className="text-slate-500">Grand Total</p>
                <p className="font-bold text-lg">₹{invoice.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">HSN</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Rate</th>
                  <th className="text-right p-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">{item.description}</td>
                    <td className="p-2">{item.hsn_code || '-'}</td>
                    <td className="p-2 text-right">{item.quantity} {item.unit}</td>
                    <td className="p-2 text-right">₹{item.rate?.toFixed(2)}</td>
                    <td className="p-2 text-right">₹{item.amount?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={5} className="p-2 text-right font-medium">Amount Before Tax</td>
                  <td className="p-2 text-right">₹{invoice.amount_before_tax?.toFixed(2)}</td>
                </tr>
                {invoice.packaging_charges > 0 && (
                  <tr>
                    <td colSpan={5} className="p-2 text-right">PKG/FWDG</td>
                    <td className="p-2 text-right">₹{invoice.packaging_charges?.toFixed(2)}</td>
                  </tr>
                )}
                {(invoice.cgst_amount ?? 0) > 0 && (
                  <>
                    <tr>
                      <td colSpan={5} className="p-2 text-right">CGST @ {invoice.cgst_rate}%</td>
                      <td className="p-2 text-right">₹{invoice.cgst_amount?.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="p-2 text-right">SGST @ {invoice.sgst_rate}%</td>
                      <td className="p-2 text-right">₹{invoice.sgst_amount?.toFixed(2)}</td>
                    </tr>
                  </>
                )}
                {(invoice.igst_amount ?? 0) > 0 && (
                  <tr>
                    <td colSpan={5} className="p-2 text-right">IGST @ {invoice.igst_rate}%</td>
                    <td className="p-2 text-right">₹{invoice.igst_amount?.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="font-bold">
                  <td colSpan={5} className="p-2 text-right">Grand Total</td>
                  <td className="p-2 text-right">₹{invoice.grand_total?.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payments</CardTitle>
            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Payment</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (Balance: ₹{balance.toFixed(2)})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        placeholder={balance.toFixed(2)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payment Mode</Label>
                      <Select
                        value={paymentForm.payment_mode}
                        onValueChange={(value: Payment['payment_mode']) => setPaymentForm({ ...paymentForm, payment_mode: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reference No.</Label>
                      <Input
                        value={paymentForm.reference_number}
                        onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                        placeholder="Cheque/UTR No."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <Button type="submit" className="w-full">Add Payment</Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Total Paid</p>
                  <p className="font-bold text-green-600">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Balance</p>
                  <p className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Payment List */}
              {payments.length > 0 ? (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        <p className="text-sm text-slate-500">
                          {formatDate(payment.payment_date)} • {payment.payment_mode}
                          {payment.reference_number && ` • ${payment.reference_number}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeletePayment(payment.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-4">No payments recorded</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
