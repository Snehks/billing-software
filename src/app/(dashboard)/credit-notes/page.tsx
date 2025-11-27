'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileText, Plus, Search, X, Filter, Download } from 'lucide-react'
import Link from 'next/link'
import { CreditNote, Party } from '@/lib/types'

export default function CreditNotesPage() {
  const supabase = createClient()

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedParty, setSelectedParty] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [creditNotesRes, partiesRes] = await Promise.all([
      supabase.from('credit_notes').select('*').order('credit_note_number', { ascending: false }),
      supabase.from('parties').select('*').order('name'),
    ])

    setCreditNotes(creditNotesRes.data || [])
    setParties(partiesRes.data || [])
    setLoading(false)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Apply filters
  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter(cn => {
      // Search filter (party name or credit note number)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = cn.party_name?.toLowerCase().includes(query)
        const matchesNumber = cn.credit_note_number?.toString().includes(query)
        if (!matchesName && !matchesNumber) return false
      }

      // Party filter
      if (selectedParty !== 'all' && cn.party_id !== selectedParty) {
        return false
      }

      // Date range filter
      if (dateFrom) {
        const cnDate = new Date(cn.credit_note_date)
        const fromDate = new Date(dateFrom)
        if (cnDate < fromDate) return false
      }
      if (dateTo) {
        const cnDate = new Date(cn.credit_note_date)
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59)
        if (cnDate > toDate) return false
      }

      return true
    })
  }, [creditNotes, searchQuery, selectedParty, dateFrom, dateTo])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedParty('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = searchQuery || selectedParty !== 'all' || dateFrom || dateTo

  // Summary stats
  const stats = useMemo(() => {
    const totalAmount = filteredCreditNotes.reduce((sum, cn) => sum + (cn.total_amount || 0), 0)
    return { totalAmount, count: filteredCreditNotes.length }
  }, [filteredCreditNotes])

  // Export to CSV
  const exportToCSV = () => {
    let csv = 'Credit Notes Export\n'
    csv += 'CN #,Date,Party,GSTIN,Reason,Taxable Amount,CGST,SGST,IGST,Total Amount\n'

    filteredCreditNotes.forEach(cn => {
      csv += `CN-${cn.credit_note_number},`
      csv += `${cn.credit_note_date},`
      csv += `"${cn.party_name}",`
      csv += `${cn.party_gstin || ''},`
      csv += `"${cn.reason}",`
      csv += `${cn.amount_before_tax || 0},`
      csv += `${cn.cgst_amount || 0},`
      csv += `${cn.sgst_amount || 0},`
      csv += `${cn.igst_amount || 0},`
      csv += `${cn.total_amount || 0}\n`
    })

    csv += `\nTotal,,,,,,,,,${stats.totalAmount}\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `credit_notes_export_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Credit Notes</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={filteredCreditNotes.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Link href="/credit-notes/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Credit Note
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search party name or CN #..."
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
                <span>Showing {stats.count} credit note{stats.count !== 1 ? 's' : ''}</span>
                <span className="text-slate-400">|</span>
                <span>Total: ₹{stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Notes List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {hasActiveFilters ? `Filtered Credit Notes (${stats.count})` : 'All Credit Notes'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500 py-8 text-center">Loading...</p>
          ) : filteredCreditNotes.length > 0 ? (
            <div className="space-y-2">
              {filteredCreditNotes.map((cn) => (
                <Link key={cn.id} href={`/credit-notes/${cn.id}`}>
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-20 text-center">
                        <p className="font-bold text-lg">CN-{cn.credit_note_number}</p>
                      </div>
                      <div>
                        <p className="font-medium">{cn.party_name}</p>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>{formatDate(cn.credit_note_date)}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-orange-600">{cn.reason}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">-₹{cn.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-2 text-sm font-medium text-slate-900">
                {hasActiveFilters ? 'No credit notes match your filters' : 'No credit notes yet'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {hasActiveFilters ? 'Try adjusting your search or filters.' : 'Create a credit note when you need to issue a refund or adjustment.'}
              </p>
              {!hasActiveFilters && (
                <div className="mt-6">
                  <Link href="/credit-notes/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Credit Note
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
