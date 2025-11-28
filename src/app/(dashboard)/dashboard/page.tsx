import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Users, TrendingUp, AlertCircle, Plus, ArrowRight } from 'lucide-react'
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
