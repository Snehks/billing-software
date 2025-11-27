import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Users, TrendingUp, AlertCircle, Plus, ArrowRight, AlertTriangle, Clock, Bell } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch all data
  const [invoicesResult, partiesResult, paymentsResult] = await Promise.all([
    supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
    supabase.from('parties').select('id', { count: 'exact' }),
    supabase.from('payments').select('invoice_id, amount'),
  ])

  const invoices = invoicesResult.data || []
  const totalParties = partiesResult.count || 0

  // Calculate payment totals
  const paymentTotals: Record<string, number> = {}
  paymentsResult.data?.forEach(p => {
    paymentTotals[p.invoice_id] = (paymentTotals[p.invoice_id] || 0) + p.amount
  })

  // Calculate metrics
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  let totalSales = 0
  let totalPaid = 0
  let monthSales = 0

  invoices.forEach(inv => {
    totalSales += inv.grand_total || 0
    totalPaid += paymentTotals[inv.id] || 0

    const invDate = new Date(inv.invoice_date)
    if (invDate >= firstDayOfMonth) {
      monthSales += inv.grand_total || 0
    }
  })

  const totalOutstanding = totalSales - totalPaid

  // Get payment status for invoice
  const getPaymentStatus = (invoiceId: string, grandTotal: number) => {
    const paid = paymentTotals[invoiceId] || 0
    if (paid >= grandTotal) return 'Paid'
    if (paid > 0) return 'Partial'
    return 'Unpaid'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }

  // Calculate overdue and due soon invoices
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const overdueInvoices = invoices.filter(inv => {
    const paid = paymentTotals[inv.id] || 0
    if (paid >= inv.grand_total) return false // Already paid
    if (!inv.due_date) return false
    const dueDate = new Date(inv.due_date)
    return dueDate < today
  })

  const dueSoonInvoices = invoices.filter(inv => {
    const paid = paymentTotals[inv.id] || 0
    if (paid >= inv.grand_total) return false // Already paid
    if (!inv.due_date) return false
    const dueDate = new Date(inv.due_date)
    return dueDate >= today && dueDate <= sevenDaysFromNow
  })

  // Recent invoices (last 5)
  const recentInvoices = invoices.slice(0, 5)

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Welcome back! Here's your business overview.</p>
        </div>
        <Link href="/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* This Month Sales */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{monthSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {invoices.filter(i => new Date(i.invoice_date) >= firstDayOfMonth).length} invoices
            </p>
          </CardContent>
        </Card>

        {/* Total Sales */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Sales</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">{invoices.length} invoices</p>
          </CardContent>
        </Card>

        {/* Outstanding */}
        <Link href="/reports">
          <Card className={`hover:shadow-md transition-shadow cursor-pointer ${totalOutstanding > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Outstanding</CardTitle>
              <AlertCircle className={`h-4 w-4 ${totalOutstanding > 0 ? 'text-red-500' : 'text-green-500'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {totalOutstanding > 0 ? 'Payment pending' : 'All clear!'}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Parties */}
        <Link href="/parties">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Parties</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalParties}</div>
              <p className="text-xs text-slate-500 mt-1">Customers</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Alerts Section */}
      {(overdueInvoices.length > 0 || dueSoonInvoices.length > 0) && (
        <div className="mb-8 space-y-4">
          {/* Overdue Invoices Alert */}
          {overdueInvoices.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-red-800">
                    {overdueInvoices.length} Overdue Invoice{overdueInvoices.length > 1 ? 's' : ''}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueInvoices.slice(0, 3).map(inv => {
                    const paid = paymentTotals[inv.id] || 0
                    const balance = inv.grand_total - paid
                    const dueDate = new Date(inv.due_date!)
                    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <Link key={inv.id} href={`/invoices/${inv.id}`}>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100 hover:border-red-300 transition-colors">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-sm">#{inv.invoice_number} - {inv.billed_to_name}</p>
                              <p className="text-xs text-red-600">
                                {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue (Due: {formatDate(inv.due_date!)})
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">₹{balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                  {overdueInvoices.length > 3 && (
                    <Link href="/invoices?status=overdue">
                      <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-100">
                        View all {overdueInvoices.length} overdue invoices
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Due Soon Alert */}
          {dueSoonInvoices.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-amber-800">
                    {dueSoonInvoices.length} Invoice{dueSoonInvoices.length > 1 ? 's' : ''} Due Soon
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dueSoonInvoices.slice(0, 3).map(inv => {
                    const paid = paymentTotals[inv.id] || 0
                    const balance = inv.grand_total - paid
                    const dueDate = new Date(inv.due_date!)
                    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <Link key={inv.id} href={`/invoices/${inv.id}`}>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition-colors">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-sm">#{inv.invoice_number} - {inv.billed_to_name}</p>
                              <p className="text-xs text-amber-600">
                                {daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`} ({formatDate(inv.due_date!)})
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-amber-600">₹{balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                  {dueSoonInvoices.length > 3 && (
                    <Link href="/invoices">
                      <Button variant="outline" size="sm" className="w-full text-amber-600 border-amber-200 hover:bg-amber-100">
                        View all {dueSoonInvoices.length} invoices due soon
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Invoices</CardTitle>
          <Link href="/invoices">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentInvoices.length > 0 ? (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => {
                const status = getPaymentStatus(invoice.id, invoice.grand_total)
                const paid = paymentTotals[invoice.id] || 0
                return (
                  <Link key={invoice.id} href={`/invoices/${invoice.id}`}>
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-14 text-center">
                          <p className="font-bold text-sm">#{invoice.invoice_number}</p>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{invoice.billed_to_name}</p>
                          <p className="text-xs text-slate-500">{formatDate(invoice.invoice_date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={status === 'Paid' ? 'default' : status === 'Partial' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {status}
                        </Badge>
                        <div className="text-right min-w-[80px]">
                          <p className="font-semibold text-sm">₹{invoice.grand_total?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                          {status !== 'Paid' && (
                            <p className="text-xs text-red-500">
                              Due: ₹{(invoice.grand_total - paid).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
                Get started by creating your first invoice.
              </p>
              <div className="mt-6">
                <Link href="/invoices/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Invoice
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
