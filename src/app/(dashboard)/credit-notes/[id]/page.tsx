'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CreditNote, CreditNoteItem } from '@/lib/types'

export default function CreditNoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [creditNote, setCreditNote] = useState<CreditNote | null>(null)
  const [items, setItems] = useState<CreditNoteItem[]>([])
  const [originalInvoice, setOriginalInvoice] = useState<{ invoice_number: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const [creditNoteRes, itemsRes] = await Promise.all([
      supabase.from('credit_notes').select('*').eq('id', params.id).single(),
      supabase.from('credit_note_items').select('*').eq('credit_note_id', params.id).order('serial_number'),
    ])

    if (creditNoteRes.data) {
      setCreditNote(creditNoteRes.data)

      // Fetch original invoice if exists
      if (creditNoteRes.data.original_invoice_id) {
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('id', creditNoteRes.data.original_invoice_id)
          .single()
        setOriginalInvoice(invoiceData)
      }
    }
    if (itemsRes.data) setItems(itemsRes.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [params.id])

  const handleDelete = async () => {
    // Delete items first
    await supabase.from('credit_note_items').delete().eq('credit_note_id', params.id)

    // Delete credit note
    const { error } = await supabase.from('credit_notes').delete().eq('id', params.id)

    if (error) {
      toast.error('Failed to delete credit note')
      return
    }

    toast.success('Credit note deleted')
    router.push('/credit-notes')
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!creditNote) return <div className="p-8">Credit note not found</div>

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/credit-notes')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Credit Note CN-{creditNote.credit_note_number}</h1>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Credit Note?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete credit note CN-{creditNote.credit_note_number}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => window.open(`/print/credit-note/${creditNote.id}`, '_blank')}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Credit Note Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Credit Note Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Date</p>
                <p className="font-medium">{formatDate(creditNote.credit_note_date)}</p>
              </div>
              <div>
                <p className="text-slate-500">Original Invoice</p>
                {originalInvoice ? (
                  <Link href={`/invoices/${creditNote.original_invoice_id}`} className="font-medium text-blue-600 hover:underline">
                    #{originalInvoice.invoice_number}
                  </Link>
                ) : (
                  <p className="font-medium text-slate-400">Not linked</p>
                )}
              </div>
              <div>
                <p className="text-slate-500">Party</p>
                {creditNote.party_id ? (
                  <Link href={`/parties/${creditNote.party_id}`} className="font-medium text-blue-600 hover:underline">
                    {creditNote.party_name}
                  </Link>
                ) : (
                  <p className="font-medium">{creditNote.party_name}</p>
                )}
              </div>
              <div>
                <p className="text-slate-500">GSTIN</p>
                <p className="font-medium">{creditNote.party_gstin || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Address</p>
                <p className="font-medium">{creditNote.party_address || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">State</p>
                <p className="font-medium">{creditNote.party_state || '-'} {creditNote.party_state_code ? `(${creditNote.party_state_code})` : ''}</p>
              </div>
              <div>
                <p className="text-slate-500">Reason</p>
                <p className="font-medium text-orange-600">{creditNote.reason}</p>
              </div>
              <div>
                <p className="text-slate-500">Total Amount</p>
                <p className="font-bold text-lg text-red-600">-₹{creditNote.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
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
                  <td className="p-2 text-right">₹{creditNote.amount_before_tax?.toFixed(2)}</td>
                </tr>
                {(creditNote.cgst_amount ?? 0) > 0 && (
                  <>
                    <tr>
                      <td colSpan={5} className="p-2 text-right">CGST @ {creditNote.cgst_rate}%</td>
                      <td className="p-2 text-right">₹{creditNote.cgst_amount?.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="p-2 text-right">SGST @ {creditNote.sgst_rate}%</td>
                      <td className="p-2 text-right">₹{creditNote.sgst_amount?.toFixed(2)}</td>
                    </tr>
                  </>
                )}
                {(creditNote.igst_amount ?? 0) > 0 && (
                  <tr>
                    <td colSpan={5} className="p-2 text-right">IGST @ {creditNote.igst_rate}%</td>
                    <td className="p-2 text-right">₹{creditNote.igst_amount?.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="font-bold text-red-600">
                  <td colSpan={5} className="p-2 text-right">Total Credit Amount</td>
                  <td className="p-2 text-right">₹{creditNote.total_amount?.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        {/* Amount in Words */}
        {creditNote.amount_in_words && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong>Amount in Words:</strong> {creditNote.amount_in_words}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {creditNote.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">{creditNote.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
