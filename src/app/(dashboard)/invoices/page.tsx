'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileText, Plus, Search, X, Filter, AlertTriangle, Download } from 'lucide-react'
import Link from 'next/link'
import { Invoice, Party } from '@/lib/types'

type PaymentStatus = 'all' | 'paid' | 'partial' | 'unpaid' | 'overdue'

export default function InvoicesPage() {
  const supabase = createClient()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [payments, setPayments] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedParty, setSelectedParty] = useState<string>('all')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [invoicesRes, partiesRes] = await Promise.all([
      supabase.from('invoices').select('*').order('invoice_number', { ascending: false }),
      supabase.from('parties').select('*').order('name'),
    ])

    const invoiceData = invoicesRes.data || []
    setInvoices(invoiceData)
    setParties(partiesRes.data || [])

    // Fetch payments
    const invoiceIds = invoiceData.map(i => i.id)
    if (invoiceIds.length > 0) {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('invoice_id, amount')
        .in('invoice_id', invoiceIds)

      const totals: Record<string, number> = {}
      paymentsData?.forEach(p => {
        totals[p.invoice_id] = (totals[p.invoice_id] || 0) + p.amount
      })
      setPayments(totals)
    }

    setLoading(false)
  }

  const getPaymentStatus = (invoice: Invoice): 'Paid' | 'Partial' | 'Unpaid' | 'Overdue' => {
    const paid = payments[invoice.id] || 0
    if (paid >= invoice.grand_total) return 'Paid'

    // Check if overdue (has due date, past due, and not fully paid)
    if (invoice.due_date) {
      const dueDate = new Date(invoice.due_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (dueDate < today) return 'Overdue'
    }

    if (paid > 0) return 'Partial'
    return 'Unpaid'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Apply filters
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      // Search filter (party name or invoice number)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = invoice.billed_to_name?.toLowerCase().includes(query)
        const matchesNumber = invoice.invoice_number?.toString().includes(query)
        if (!matchesName && !matchesNumber) return false
      }

      // Party filter
      if (selectedParty !== 'all' && invoice.party_id !== selectedParty) {
        return false
      }

      // Payment status filter
      if (paymentStatus !== 'all') {
        const status = getPaymentStatus(invoice)
        if (paymentStatus === 'paid' && status !== 'Paid') return false
        if (paymentStatus === 'partial' && status !== 'Partial') return false
        if (paymentStatus === 'unpaid' && status !== 'Unpaid') return false
        if (paymentStatus === 'overdue' && status !== 'Overdue') return false
      }

      // Date range filter
      if (dateFrom) {
        const invoiceDate = new Date(invoice.invoice_date)
        const fromDate = new Date(dateFrom)
        if (invoiceDate < fromDate) return false
      }
      if (dateTo) {
        const invoiceDate = new Date(invoice.invoice_date)
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59)
        if (invoiceDate > toDate) return false
      }

      return true
    })
  }, [invoices, searchQuery, selectedParty, paymentStatus, dateFrom, dateTo, payments])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedParty('all')
    setPaymentStatus('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = searchQuery || selectedParty !== 'all' || paymentStatus !== 'all' || dateFrom || dateTo

  // Export to CSV
  const exportToCSV = () => {
    let csv = 'Invoice Export\n'
    csv += 'Invoice #,Date,Due Date,Party,GSTIN,Taxable Amount,CGST,SGST,IGST,Grand Total,Paid,Balance,Status\n'

    filteredInvoices.forEach(inv => {
      const paid = payments[inv.id] || 0
      const balance = (inv.grand_total || 0) - paid
      const status = getPaymentStatus(inv)

      csv += `${inv.invoice_number},`
      csv += `${inv.invoice_date},`
      csv += `${inv.due_date || ''},`
      csv += `"${inv.billed_to_name}",`
      csv += `${inv.party_gstin || ''},`
      csv += `${inv.sub_total || 0},`
      csv += `${inv.cgst_amount || 0},`
      csv += `${inv.sgst_amount || 0},`
      csv += `${inv.igst_amount || 0},`
      csv += `${inv.grand_total || 0},`
      csv += `${paid},`
      csv += `${balance},`
      csv += `${status}\n`
    })

    csv += `\nTotal,,,,,,,,${stats.totalAmount},${stats.totalPaid},${stats.totalDue},\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Summary stats
  const stats = useMemo(() => {
    let totalAmount = 0
    let totalPaid = 0
    let totalDue = 0

    filteredInvoices.forEach(invoice => {
      totalAmount += invoice.grand_total || 0
      const paid = payments[invoice.id] || 0
      totalPaid += paid
      totalDue += Math.max(0, (invoice.grand_total || 0) - paid)
    })

    return { totalAmount, totalPaid, totalDue, count: filteredInvoices.length }
  }, [filteredInvoices, payments])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={filteredInvoices.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Link href="/invoices/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search party name or invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Party filter */}
            <Select value={selectedParty} onValueChange={setSelectedParty}>
              <SelectTrigger>
                <SelectValue placeholder="All Parties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                {parties.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    {party.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <Input
              type="date"
              placeholder="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              placeholder="To date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Filter className="h-4 w-4" />
                <span>Showing {stats.count} invoice{stats.count !== 1 ? 's' : ''}</span>
                <span className="text-slate-400">|</span>
                <span>Total: ₹{stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span className="text-slate-400">|</span>
                <span className="text-green-600">Paid: ₹{stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span className="text-slate-400">|</span>
                <span className="text-red-600">Due: ₹{stats.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {hasActiveFilters ? `Filtered Invoices (${stats.count})` : 'All Invoices'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500 py-8 text-center">Loading...</p>
          ) : filteredInvoices.length > 0 ? (
            <div className="space-y-2">
              {filteredInvoices.map((invoice) => {
                const status = getPaymentStatus(invoice)
                const paid = payments[invoice.id] || 0
                const isOverdue = status === 'Overdue'
                return (
                  <Link key={invoice.id} href={`/invoices/${invoice.id}`}>
                    <div className={`flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors ${isOverdue ? 'border-red-200 bg-red-50/50' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-16 text-center">
                          <p className="font-bold text-lg">#{invoice.invoice_number}</p>
                        </div>
                        <div>
                          <p className="font-medium">{invoice.billed_to_name}</p>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>{formatDate(invoice.invoice_date)}</span>
                            {invoice.due_date && (
                              <>
                                <span className="text-slate-300">|</span>
                                <span className={isOverdue ? 'text-red-500' : ''}>
                                  Due: {formatDate(invoice.due_date)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={status === 'Paid' ? 'default' : status === 'Partial' ? 'secondary' : 'destructive'}
                          className={isOverdue ? 'bg-red-600' : ''}
                        >
                          {isOverdue && <AlertTriangle className="mr-1 h-3 w-3" />}
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
              <h3 className="mt-2 text-sm font-medium text-slate-900">
                {hasActiveFilters ? 'No invoices match your filters' : 'No invoices yet'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {hasActiveFilters ? 'Try adjusting your search or filters.' : 'Get started by creating your first invoice.'}
              </p>
              {!hasActiveFilters && (
                <div className="mt-6">
                  <Link href="/invoices/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Invoice
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
