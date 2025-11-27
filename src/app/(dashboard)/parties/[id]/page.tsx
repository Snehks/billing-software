'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, Phone, Mail, MapPin, Building2, Plus, Download, Printer } from 'lucide-react'
import Link from 'next/link'
import { Party, Invoice, Payment, PAYMENT_TERMS } from '@/lib/types'

export default function PartyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [party, setParty] = useState<Party | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Record<string, number>>({})
  const [allPayments, setAllPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'invoices' | 'ledger'>('invoices')

  useEffect(() => {
    fetchData()
  }, [params.id])

  const fetchData = async () => {
    // Fetch party details
    const { data: partyData } = await supabase
      .from('parties')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!partyData) {
      router.push('/parties')
      return
    }

    setParty(partyData)

    // Fetch invoices for this party
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('*')
      .eq('party_id', params.id)
      .order('invoice_date', { ascending: false })

    setInvoices(invoicesData || [])

    // Fetch payments for these invoices
    const invoiceIds = invoicesData?.map(i => i.id) || []
    if (invoiceIds.length > 0) {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('payment_date', { ascending: true })

      const totals: Record<string, number> = {}
      paymentsData?.forEach(p => {
        totals[p.invoice_id] = (totals[p.invoice_id] || 0) + p.amount
      })
      setPayments(totals)
      setAllPayments(paymentsData || [])
    }

    setLoading(false)
  }

  const getPaymentStatus = (invoiceId: string, grandTotal: number): 'Paid' | 'Partial' | 'Unpaid' => {
    const paid = payments[invoiceId] || 0
    if (paid >= grandTotal) return 'Paid'
    if (paid > 0) return 'Partial'
    return 'Unpaid'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Calculate summary
  const summary = {
    totalInvoices: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0),
    totalPaid: Object.values(payments).reduce((sum, amt) => sum + amt, 0),
    get totalDue() { return this.totalAmount - this.totalPaid },
  }

  // Generate ledger entries
  interface LedgerEntry {
    date: string
    type: 'invoice' | 'payment'
    reference: string
    description: string
    debit: number
    credit: number
    balance: number
    id: string
  }

  const ledgerEntries: LedgerEntry[] = []

  // Add invoices as debits
  invoices.forEach(inv => {
    ledgerEntries.push({
      date: inv.invoice_date,
      type: 'invoice',
      reference: `INV-${inv.invoice_number}`,
      description: `Invoice #${inv.invoice_number}`,
      debit: inv.grand_total,
      credit: 0,
      balance: 0, // Will be calculated
      id: inv.id,
    })
  })

  // Add payments as credits
  allPayments.forEach(pmt => {
    const invoice = invoices.find(inv => inv.id === pmt.invoice_id)
    ledgerEntries.push({
      date: pmt.payment_date,
      type: 'payment',
      reference: pmt.reference_number || pmt.payment_mode,
      description: `Payment for INV-${invoice?.invoice_number || '?'} (${pmt.payment_mode})`,
      debit: 0,
      credit: pmt.amount,
      balance: 0, // Will be calculated
      id: pmt.id,
    })
  })

  // Sort by date and calculate running balance
  ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let runningBalance = 0
  ledgerEntries.forEach(entry => {
    runningBalance += entry.debit - entry.credit
    entry.balance = runningBalance
  })

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  if (!party) {
    return <div className="p-8 text-center">Party not found</div>
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/parties')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Parties
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{party.name}</h1>
            {party.gstin && (
              <p className="text-sm text-slate-500 mt-1">GSTIN: {party.gstin}</p>
            )}
          </div>
          <Link href={`/invoices/new?party=${party.id}`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Party Details & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {party.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <span>{party.address}</span>
              </div>
            )}
            {party.state && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span>{party.state} ({party.state_code})</span>
              </div>
            )}
            {party.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{party.phone}</span>
              </div>
            )}
            {party.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{party.email}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Total Invoices</span>
                <span className="font-semibold">{summary.totalInvoices}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Total Billed</span>
                <span className="font-semibold">₹{summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Total Paid</span>
                <span className="font-semibold text-green-600">₹{summary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outstanding */}
        <Card className={summary.totalDue > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${summary.totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{summary.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            {summary.totalDue > 0 && (
              <p className="text-sm text-red-600 mt-1">Payment pending</p>
            )}
            {summary.totalDue === 0 && summary.totalInvoices > 0 && (
              <p className="text-sm text-green-600 mt-1">All payments received</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <button
                onClick={() => setViewMode('invoices')}
                className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                  viewMode === 'invoices'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Invoice History
              </button>
              <button
                onClick={() => setViewMode('ledger')}
                className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                  viewMode === 'ledger'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Ledger Statement
              </button>
            </div>
            {viewMode === 'ledger' && ledgerEntries.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print Statement
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'invoices' ? (
            // Invoice History View
            invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.map((invoice) => {
                  const status = getPaymentStatus(invoice.id, invoice.grand_total)
                  const paid = payments[invoice.id] || 0
                  return (
                    <Link key={invoice.id} href={`/invoices/${invoice.id}`}>
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-16 text-center">
                            <p className="font-bold text-lg">#{invoice.invoice_number}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">{formatDate(invoice.invoice_date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={status === 'Paid' ? 'default' : status === 'Partial' ? 'secondary' : 'destructive'}>
                            {status}
                          </Badge>
                          <div className="text-right">
                            <p className="font-bold">₹{invoice.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            {status !== 'Paid' && (
                              <p className="text-sm text-red-500">
                                Due: ₹{(invoice.grand_total - paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-2 text-sm font-medium text-slate-900">No invoices yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first invoice for this party.
                </p>
                <div className="mt-6">
                  <Link href={`/invoices/new?party=${party.id}`}>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Invoice
                    </Button>
                  </Link>
                </div>
              </div>
            )
          ) : (
            // Ledger View
            ledgerEntries.length > 0 ? (
              <div className="overflow-x-auto print:overflow-visible">
                {/* Print Header (only visible when printing) */}
                <div className="hidden print:block mb-6">
                  <h2 className="text-xl font-bold">Account Statement</h2>
                  <p className="text-sm text-slate-600">{party.name}</p>
                  <p className="text-sm text-slate-500">As of {formatDate(new Date().toISOString())}</p>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Reference</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Debit (₹)</th>
                      <th className="text-right p-3 font-medium">Credit (₹)</th>
                      <th className="text-right p-3 font-medium">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((entry, index) => (
                      <tr key={entry.id + index} className="border-b hover:bg-slate-50">
                        <td className="p-3">{formatDate(entry.date)}</td>
                        <td className="p-3">
                          {entry.type === 'invoice' ? (
                            <Link href={`/invoices/${entry.id}`} className="text-blue-600 hover:underline">
                              {entry.reference}
                            </Link>
                          ) : (
                            <span className="text-green-600">{entry.reference}</span>
                          )}
                        </td>
                        <td className="p-3">{entry.description}</td>
                        <td className="p-3 text-right">
                          {entry.debit > 0 ? entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-3 text-right text-green-600">
                          {entry.credit > 0 ? entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className={`p-3 text-right font-medium ${entry.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {entry.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-slate-100 font-bold">
                      <td colSpan={3} className="p-3 text-right">Totals:</td>
                      <td className="p-3 text-right">
                        {summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right text-green-600">
                        {summary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`p-3 text-right ${summary.totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {summary.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-2 text-sm font-medium text-slate-900">No transactions yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Create an invoice to start the ledger.
                </p>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
