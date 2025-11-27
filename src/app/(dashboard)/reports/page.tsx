'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TrendingUp, IndianRupee, Users, FileText, AlertCircle, Clock, FileDown } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Invoice, Party } from '@/lib/types'

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

export default function ReportsPage() {
  const supabase = createClient()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [payments, setPayments] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Filters
  const [period, setPeriod] = useState<Period>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  // Set date range based on period
  useEffect(() => {
    const today = new Date()
    let from = new Date()

    switch (period) {
      case 'today':
        from = today
        break
      case 'week':
        from.setDate(today.getDate() - 7)
        break
      case 'month':
        from.setMonth(today.getMonth() - 1)
        break
      case 'quarter':
        from.setMonth(today.getMonth() - 3)
        break
      case 'year':
        from.setFullYear(today.getFullYear() - 1)
        break
      case 'custom':
        return // Don't change dates for custom
    }

    setDateFrom(from.toISOString().split('T')[0])
    setDateTo(today.toISOString().split('T')[0])
  }, [period])

  const fetchData = async () => {
    const [invoicesRes, partiesRes] = await Promise.all([
      supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
      supabase.from('parties').select('*').order('name'),
    ])

    const invoiceData = invoicesRes.data || []
    setInvoices(invoiceData)
    setParties(partiesRes.data || [])

    // Fetch all payments
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

  // Filter invoices by date range
  const filteredInvoices = useMemo(() => {
    if (!dateFrom && !dateTo) return invoices

    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.invoice_date)
      if (dateFrom && invoiceDate < new Date(dateFrom)) return false
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59)
        if (invoiceDate > toDate) return false
      }
      return true
    })
  }, [invoices, dateFrom, dateTo])

  // Calculate summary stats
  const summary = useMemo(() => {
    let totalSales = 0
    let totalTax = 0
    let totalPaid = 0

    filteredInvoices.forEach(inv => {
      totalSales += inv.grand_total || 0
      totalTax += (inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0)
      totalPaid += payments[inv.id] || 0
    })

    return {
      invoiceCount: filteredInvoices.length,
      totalSales,
      totalTax,
      totalPaid,
      totalDue: totalSales - totalPaid,
    }
  }, [filteredInvoices, payments])

  // Outstanding by party
  const outstandingByParty = useMemo(() => {
    const partyTotals: Record<string, { name: string; total: number; paid: number; due: number; invoiceCount: number }> = {}

    // Include all invoices for outstanding calculation (not just filtered)
    invoices.forEach(inv => {
      if (!inv.party_id) return

      if (!partyTotals[inv.party_id]) {
        const party = parties.find(p => p.id === inv.party_id)
        partyTotals[inv.party_id] = {
          name: party?.name || inv.billed_to_name || 'Unknown',
          total: 0,
          paid: 0,
          due: 0,
          invoiceCount: 0,
        }
      }

      const paid = payments[inv.id] || 0
      const due = Math.max(0, (inv.grand_total || 0) - paid)

      partyTotals[inv.party_id].total += inv.grand_total || 0
      partyTotals[inv.party_id].paid += paid
      partyTotals[inv.party_id].due += due
      partyTotals[inv.party_id].invoiceCount++
    })

    return Object.entries(partyTotals)
      .map(([id, data]) => ({ id, ...data }))
      .filter(p => p.due > 0)
      .sort((a, b) => b.due - a.due)
  }, [invoices, parties, payments])

  // Monthly sales trend
  const monthlySales = useMemo(() => {
    const months: Record<string, { sales: number; count: number }> = {}

    invoices.forEach(inv => {
      const date = new Date(inv.invoice_date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!months[key]) {
        months[key] = { sales: 0, count: 0 }
      }
      months[key].sales += inv.grand_total || 0
      months[key].count++
    })

    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .reverse()
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        ...data,
      }))
  }, [invoices])

  // Aging Analysis
  const agingAnalysis = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const buckets = {
      current: { label: 'Current', invoices: [] as (Invoice & { due: number; daysOverdue: number })[], total: 0 },
      days1_30: { label: '1-30 Days', invoices: [] as (Invoice & { due: number; daysOverdue: number })[], total: 0 },
      days31_60: { label: '31-60 Days', invoices: [] as (Invoice & { due: number; daysOverdue: number })[], total: 0 },
      days61_90: { label: '61-90 Days', invoices: [] as (Invoice & { due: number; daysOverdue: number })[], total: 0 },
      days90plus: { label: '90+ Days', invoices: [] as (Invoice & { due: number; daysOverdue: number })[], total: 0 },
    }

    invoices.forEach(inv => {
      const paid = payments[inv.id] || 0
      const due = (inv.grand_total || 0) - paid

      // Skip fully paid invoices
      if (due <= 0) return

      // Calculate days overdue based on due_date or invoice_date
      const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date)
      dueDate.setHours(0, 0, 0, 0)
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

      const invoiceWithDue = { ...inv, due, daysOverdue }

      if (daysOverdue <= 0) {
        buckets.current.invoices.push(invoiceWithDue)
        buckets.current.total += due
      } else if (daysOverdue <= 30) {
        buckets.days1_30.invoices.push(invoiceWithDue)
        buckets.days1_30.total += due
      } else if (daysOverdue <= 60) {
        buckets.days31_60.invoices.push(invoiceWithDue)
        buckets.days31_60.total += due
      } else if (daysOverdue <= 90) {
        buckets.days61_90.invoices.push(invoiceWithDue)
        buckets.days61_90.total += due
      } else {
        buckets.days90plus.invoices.push(invoiceWithDue)
        buckets.days90plus.total += due
      }
    })

    // Sort invoices within each bucket by days overdue (most overdue first)
    Object.values(buckets).forEach(bucket => {
      bucket.invoices.sort((a, b) => b.daysOverdue - a.daysOverdue)
    })

    const grandTotal = Object.values(buckets).reduce((sum, b) => sum + b.total, 0)

    return { buckets, grandTotal }
  }, [invoices, payments])

  if (loading) {
    return <div className="p-8 text-center">Loading reports...</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1">Sales summary and outstanding analysis</p>
        </div>
        <Link href="/reports/gstr1">
          <Button>
            <FileDown className="mr-2 h-4 w-4" />
            GSTR-1 Export
          </Button>
        </Link>
      </div>

      {/* Period Filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-40">
              <label className="text-sm text-slate-500 mb-1 block">Period</label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="quarter">Last 3 Months</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-500 mb-1 block">From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPeriod('custom'); }}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-sm text-slate-500 mb-1 block">To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPeriod('custom'); }}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Invoices</p>
                <p className="text-2xl font-bold">{summary.invoiceCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Sales</p>
                <p className="text-2xl font-bold">₹{summary.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <IndianRupee className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Tax Collected</p>
                <p className="text-2xl font-bold">₹{summary.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={summary.totalDue > 0 ? 'border-red-200' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${summary.totalDue > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <AlertCircle className={`h-5 w-5 ${summary.totalDue > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Outstanding</p>
                <p className={`text-2xl font-bold ${summary.totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{summary.totalDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySales.length > 0 ? (
              <div className="space-y-3">
                {monthlySales.map((month, index) => {
                  const maxSales = Math.max(...monthlySales.map(m => m.sales))
                  const percentage = maxSales > 0 ? (month.sales / maxSales) * 100 : 0
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{month.month}</span>
                        <span className="text-slate-600">
                          ₹{month.sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          <span className="text-slate-400 ml-2">({month.count} inv)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No sales data available</p>
            )}
          </CardContent>
        </Card>

        {/* Outstanding by Party */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Outstanding by Party</span>
              {outstandingByParty.length > 0 && (
                <span className="text-sm font-normal text-slate-500">
                  {outstandingByParty.length} {outstandingByParty.length === 1 ? 'party' : 'parties'}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {outstandingByParty.length > 0 ? (
              <div className="space-y-3">
                {outstandingByParty.slice(0, 10).map((party) => (
                  <Link key={party.id} href={`/parties/${party.id}`}>
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                      <div>
                        <p className="font-medium">{party.name}</p>
                        <p className="text-xs text-slate-500">{party.invoiceCount} invoices</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">
                          ₹{party.due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500">
                          of ₹{party.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
                {outstandingByParty.length > 10 && (
                  <p className="text-sm text-slate-500 text-center">
                    +{outstandingByParty.length - 10} more parties with outstanding
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-3">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-green-600 font-medium">All Clear!</p>
                <p className="text-slate-500 text-sm">No outstanding payments</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aging Analysis */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Aging Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agingAnalysis.grandTotal > 0 ? (
            <div className="space-y-6">
              {/* Summary Bars */}
              <div className="grid grid-cols-5 gap-2 p-4 bg-slate-50 rounded-lg">
                {Object.entries(agingAnalysis.buckets).map(([key, bucket]) => {
                  const percentage = agingAnalysis.grandTotal > 0
                    ? (bucket.total / agingAnalysis.grandTotal) * 100
                    : 0
                  const colors = {
                    current: 'bg-green-500',
                    days1_30: 'bg-yellow-500',
                    days31_60: 'bg-orange-500',
                    days61_90: 'bg-red-400',
                    days90plus: 'bg-red-600',
                  }
                  const textColors = {
                    current: 'text-green-600',
                    days1_30: 'text-yellow-600',
                    days31_60: 'text-orange-600',
                    days61_90: 'text-red-500',
                    days90plus: 'text-red-700',
                  }
                  return (
                    <div key={key} className="text-center">
                      <p className="text-xs text-slate-500 mb-1">{bucket.label}</p>
                      <p className={`text-lg font-bold ${textColors[key as keyof typeof textColors]}`}>
                        ₹{bucket.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-slate-400">{bucket.invoices.length} inv</p>
                      <div className="h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full ${colors[key as keyof typeof colors]} rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{percentage.toFixed(0)}%</p>
                    </div>
                  )
                })}
              </div>

              {/* Detailed Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-3 font-medium">Invoice #</th>
                      <th className="text-left p-3 font-medium">Party</th>
                      <th className="text-left p-3 font-medium">Invoice Date</th>
                      <th className="text-left p-3 font-medium">Due Date</th>
                      <th className="text-center p-3 font-medium">Days Overdue</th>
                      <th className="text-right p-3 font-medium">Total</th>
                      <th className="text-right p-3 font-medium">Outstanding</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agingAnalysis.buckets).flatMap(([key, bucket]) =>
                      bucket.invoices.slice(0, key === 'current' ? 5 : 10).map(inv => {
                        const statusColors = {
                          current: 'bg-green-100 text-green-800',
                          days1_30: 'bg-yellow-100 text-yellow-800',
                          days31_60: 'bg-orange-100 text-orange-800',
                          days61_90: 'bg-red-100 text-red-700',
                          days90plus: 'bg-red-200 text-red-800',
                        }
                        return (
                          <tr key={inv.id} className="border-b hover:bg-slate-50">
                            <td className="p-3">
                              <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline font-medium">
                                #{inv.invoice_number}
                              </Link>
                            </td>
                            <td className="p-3">{inv.billed_to_name}</td>
                            <td className="p-3 text-slate-600">
                              {new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="p-3 text-slate-600">
                              {inv.due_date
                                ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '-'
                              }
                            </td>
                            <td className="p-3 text-center">
                              {inv.daysOverdue <= 0 ? (
                                <span className="text-green-600">Not due</span>
                              ) : (
                                <span className="text-red-600 font-medium">{inv.daysOverdue} days</span>
                              )}
                            </td>
                            <td className="p-3 text-right">₹{inv.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-medium text-red-600">
                              ₹{inv.due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[key as keyof typeof statusColors]}`}>
                                {bucket.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-slate-100 font-bold">
                      <td colSpan={6} className="p-3 text-right">Total Outstanding:</td>
                      <td className="p-3 text-right text-red-600">
                        ₹{agingAnalysis.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Show count of hidden invoices */}
              {Object.values(agingAnalysis.buckets).some(b => b.invoices.length > 10) && (
                <p className="text-sm text-slate-500 text-center">
                  Showing top invoices per category. View individual invoices for complete list.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-3">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-green-600 font-medium">No Outstanding Invoices</p>
              <p className="text-slate-500 text-sm">All invoices have been paid</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
