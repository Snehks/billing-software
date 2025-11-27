'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Download, FileJson, FileSpreadsheet, Building2, Users, AlertCircle } from 'lucide-react'
import { Invoice, CreditNote, CompanySettings } from '@/lib/types'

interface B2BInvoice {
  ctin: string // Customer GSTIN
  inv: {
    inum: string // Invoice number
    idt: string // Invoice date (dd-mm-yyyy)
    val: number // Invoice value
    pos: string // Place of supply (state code)
    rchrg: 'Y' | 'N' // Reverse charge
    inv_typ: 'R' | 'SEWP' | 'SEWOP' | 'DE' // Invoice type
    itms: {
      num: number
      itm_det: {
        txval: number // Taxable value
        rt: number // GST rate
        camt?: number // CGST amount
        samt?: number // SGST amount
        iamt?: number // IGST amount
      }
    }[]
  }[]
}

interface B2CSInvoice {
  sply_ty: 'INTRA' | 'INTER' // Supply type
  pos: string // Place of supply
  typ: 'OE' | 'E' // Type (OE = without e-commerce, E = with e-commerce)
  txval: number // Total taxable value
  rt: number // Rate
  camt?: number // CGST
  samt?: number // SGST
  iamt?: number // IGST
}

export default function GSTR1ExportPage() {
  const router = useRouter()
  const supabase = createClient()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Period selection
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString().padStart(2, '0'))

  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]

  const years = Array.from({ length: 5 }, (_, i) => (currentDate.getFullYear() - i).toString())

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [invoicesRes, creditNotesRes, settingsRes] = await Promise.all([
      supabase.from('invoices').select('*').order('invoice_date'),
      supabase.from('credit_notes').select('*').order('credit_note_date'),
      supabase.from('company_settings').select('*').eq('id', 1).single(),
    ])

    setInvoices(invoicesRes.data || [])
    setCreditNotes(creditNotesRes.data || [])
    setSettings(settingsRes.data)
    setLoading(false)
  }

  // Filter invoices for selected period
  const filteredInvoices = useMemo(() => {
    const startDate = new Date(`${selectedYear}-${selectedMonth}-01`)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)
    endDate.setDate(0) // Last day of month

    return invoices.filter(inv => {
      const invDate = new Date(inv.invoice_date)
      return invDate >= startDate && invDate <= endDate
    })
  }, [invoices, selectedYear, selectedMonth])

  // Filter credit notes for selected period
  const filteredCreditNotes = useMemo(() => {
    const startDate = new Date(`${selectedYear}-${selectedMonth}-01`)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)
    endDate.setDate(0)

    return creditNotes.filter(cn => {
      const cnDate = new Date(cn.credit_note_date)
      return cnDate >= startDate && cnDate <= endDate
    })
  }, [creditNotes, selectedYear, selectedMonth])

  // Categorize invoices
  const categorizedData = useMemo(() => {
    const b2b: Invoice[] = [] // With GSTIN
    const b2cs: Invoice[] = [] // Without GSTIN, value <= 2.5L
    const b2cl: Invoice[] = [] // Without GSTIN, value > 2.5L, inter-state

    const companyStateCode = settings?.state_code || '07'

    filteredInvoices.forEach(inv => {
      if (inv.party_gstin) {
        b2b.push(inv)
      } else {
        const isInterState = inv.place_of_supply_state_code && inv.place_of_supply_state_code !== companyStateCode
        if (isInterState && inv.grand_total > 250000) {
          b2cl.push(inv)
        } else {
          b2cs.push(inv)
        }
      }
    })

    return { b2b, b2cs, b2cl }
  }, [filteredInvoices, settings])

  // Summary stats
  const summary = useMemo(() => {
    const b2bTotal = categorizedData.b2b.reduce((sum, inv) => sum + inv.grand_total, 0)
    const b2csTotal = categorizedData.b2cs.reduce((sum, inv) => sum + inv.grand_total, 0)
    const b2clTotal = categorizedData.b2cl.reduce((sum, inv) => sum + inv.grand_total, 0)
    const creditNotesTotal = filteredCreditNotes.reduce((sum, cn) => sum + cn.total_amount, 0)

    const totalTax = filteredInvoices.reduce((sum, inv) => {
      return sum + (inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0)
    }, 0)

    return {
      totalInvoices: filteredInvoices.length,
      b2bCount: categorizedData.b2b.length,
      b2bTotal,
      b2csCount: categorizedData.b2cs.length,
      b2csTotal,
      b2clCount: categorizedData.b2cl.length,
      b2clTotal,
      creditNotesCount: filteredCreditNotes.length,
      creditNotesTotal,
      totalTax,
      grandTotal: b2bTotal + b2csTotal + b2clTotal,
    }
  }, [categorizedData, filteredInvoices, filteredCreditNotes])

  // Format date for GSTR-1 (dd-mm-yyyy)
  const formatGSTRDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  // Generate GSTR-1 JSON
  const generateGSTR1JSON = () => {
    const companyStateCode = settings?.state_code || '07'

    // B2B Section
    const b2b: B2BInvoice[] = []
    const b2bGrouped: Record<string, Invoice[]> = {}

    categorizedData.b2b.forEach(inv => {
      const gstin = inv.party_gstin || ''
      if (!b2bGrouped[gstin]) b2bGrouped[gstin] = []
      b2bGrouped[gstin].push(inv)
    })

    Object.entries(b2bGrouped).forEach(([gstin, invs]) => {
      b2b.push({
        ctin: gstin,
        inv: invs.map(inv => ({
          inum: inv.invoice_number.toString(),
          idt: formatGSTRDate(inv.invoice_date),
          val: inv.grand_total,
          pos: inv.place_of_supply_state_code || companyStateCode,
          rchrg: inv.reverse_charge ? 'Y' : 'N',
          inv_typ: 'R', // Regular
          itms: [{
            num: 1,
            itm_det: {
              txval: inv.sub_total,
              rt: (inv.cgst_rate || 0) * 2 || inv.igst_rate || 18,
              ...(inv.cgst_amount ? { camt: inv.cgst_amount, samt: inv.sgst_amount ?? undefined } : {}),
              ...(inv.igst_amount ? { iamt: inv.igst_amount } : {}),
            }
          }]
        }))
      })
    })

    // B2CS Section (aggregated by rate and place of supply)
    const b2csGrouped: Record<string, { txval: number; camt: number; samt: number; iamt: number; pos: string; isIntra: boolean }> = {}

    categorizedData.b2cs.forEach(inv => {
      const pos = inv.place_of_supply_state_code || companyStateCode
      const isIntra = pos === companyStateCode
      const rate = (inv.cgst_rate || 0) * 2 || inv.igst_rate || 18
      const key = `${pos}-${rate}-${isIntra ? 'INTRA' : 'INTER'}`

      if (!b2csGrouped[key]) {
        b2csGrouped[key] = { txval: 0, camt: 0, samt: 0, iamt: 0, pos, isIntra }
      }
      b2csGrouped[key].txval += inv.sub_total
      b2csGrouped[key].camt += inv.cgst_amount || 0
      b2csGrouped[key].samt += inv.sgst_amount || 0
      b2csGrouped[key].iamt += inv.igst_amount || 0
    })

    const b2cs: B2CSInvoice[] = Object.entries(b2csGrouped).map(([key, data]) => {
      const rate = parseFloat(key.split('-')[1])
      return {
        sply_ty: data.isIntra ? 'INTRA' : 'INTER',
        pos: data.pos,
        typ: 'OE',
        txval: Math.round(data.txval * 100) / 100,
        rt: rate,
        ...(data.isIntra ? { camt: Math.round(data.camt * 100) / 100, samt: Math.round(data.samt * 100) / 100 } : { iamt: Math.round(data.iamt * 100) / 100 }),
      }
    })

    // Credit Notes Section
    const cdnr = filteredCreditNotes
      .filter(cn => cn.party_gstin)
      .map(cn => ({
        ctin: cn.party_gstin,
        nt: [{
          ntty: 'C', // Credit note
          nt_num: `CN-${cn.credit_note_number}`,
          nt_dt: formatGSTRDate(cn.credit_note_date),
          val: cn.total_amount,
          pos: cn.party_state_code || companyStateCode,
          rchrg: 'N',
          inv_typ: 'R',
          itms: [{
            num: 1,
            itm_det: {
              txval: cn.amount_before_tax,
              rt: (cn.cgst_rate || 0) * 2 || cn.igst_rate || 18,
              ...(cn.cgst_amount ? { camt: cn.cgst_amount, samt: cn.sgst_amount } : {}),
              ...(cn.igst_amount ? { iamt: cn.igst_amount } : {}),
            }
          }]
        }]
      }))

    const gstr1 = {
      gstin: settings?.gstin || '',
      fp: `${selectedMonth}${selectedYear}`, // Filing period
      gt: summary.grandTotal,
      cur_gt: summary.grandTotal,
      b2b,
      b2cs,
      ...(cdnr.length > 0 ? { cdnr } : {}),
    }

    return gstr1
  }

  // Download JSON
  const downloadJSON = () => {
    const data = generateGSTR1JSON()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `GSTR1_${selectedMonth}_${selectedYear}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Download Excel/CSV
  const downloadCSV = () => {
    // B2B Sheet
    let csv = 'GSTR-1 Export - B2B Invoices\n'
    csv += 'Invoice No,Invoice Date,Customer GSTIN,Customer Name,Place of Supply,Taxable Value,CGST,SGST,IGST,Total\n'

    categorizedData.b2b.forEach(inv => {
      csv += `${inv.invoice_number},${inv.invoice_date},${inv.party_gstin || ''},`
      csv += `"${inv.billed_to_name}",${inv.place_of_supply || ''},${inv.sub_total},`
      csv += `${inv.cgst_amount || 0},${inv.sgst_amount || 0},${inv.igst_amount || 0},${inv.grand_total}\n`
    })

    csv += '\n\nB2CS Summary (Unregistered - Small)\n'
    csv += 'Place of Supply,Type,Taxable Value,CGST,SGST,IGST,Total\n'

    categorizedData.b2cs.forEach(inv => {
      csv += `${inv.place_of_supply || ''},Unregistered,${inv.sub_total},`
      csv += `${inv.cgst_amount || 0},${inv.sgst_amount || 0},${inv.igst_amount || 0},${inv.grand_total}\n`
    })

    if (filteredCreditNotes.length > 0) {
      csv += '\n\nCredit Notes\n'
      csv += 'CN No,CN Date,Customer GSTIN,Customer Name,Reason,Taxable Value,CGST,SGST,IGST,Total\n'

      filteredCreditNotes.forEach(cn => {
        csv += `CN-${cn.credit_note_number},${cn.credit_note_date},${cn.party_gstin || ''},`
        csv += `"${cn.party_name}","${cn.reason}",${cn.amount_before_tax},`
        csv += `${cn.cgst_amount || 0},${cn.sgst_amount || 0},${cn.igst_amount || 0},${cn.total_amount}\n`
      })
    }

    csv += '\n\nSummary\n'
    csv += `Total B2B,${summary.b2bCount},${summary.b2bTotal}\n`
    csv += `Total B2CS,${summary.b2csCount},${summary.b2csTotal}\n`
    csv += `Total B2CL,${summary.b2clCount},${summary.b2clTotal}\n`
    csv += `Credit Notes,${summary.creditNotesCount},${summary.creditNotesTotal}\n`
    csv += `Total Tax,,${summary.totalTax}\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `GSTR1_${selectedMonth}_${selectedYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/reports')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">GSTR-1 Export</h1>
        <p className="text-slate-500 mt-1">Generate GST Return data for filing</p>
      </div>

      {/* Period Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="w-40">
              <label className="text-sm text-slate-500 mb-1 block">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-sm text-slate-500 mb-1 block">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={downloadCSV}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={downloadJSON}>
                <FileJson className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
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
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">B2B Invoices</p>
                <p className="text-2xl font-bold">{summary.b2bCount}</p>
                <p className="text-sm text-slate-600">₹{summary.b2bTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">B2CS Invoices</p>
                <p className="text-2xl font-bold">{summary.b2csCount}</p>
                <p className="text-sm text-slate-600">₹{summary.b2csTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Download className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Credit Notes</p>
                <p className="text-2xl font-bold">{summary.creditNotesCount}</p>
                <p className="text-sm text-slate-600">₹{summary.creditNotesTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Tax Liability</p>
                <p className="text-2xl font-bold text-blue-700">₹{summary.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* B2B Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>B2B Invoices (To Registered Dealers)</CardTitle>
        </CardHeader>
        <CardContent>
          {categorizedData.b2b.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left p-3 font-medium">Invoice #</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Customer GSTIN</th>
                    <th className="text-left p-3 font-medium">Customer Name</th>
                    <th className="text-left p-3 font-medium">Place of Supply</th>
                    <th className="text-right p-3 font-medium">Taxable Value</th>
                    <th className="text-right p-3 font-medium">Tax</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {categorizedData.b2b.map(inv => (
                    <tr key={inv.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-medium">#{inv.invoice_number}</td>
                      <td className="p-3">{new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="p-3 font-mono text-xs">{inv.party_gstin}</td>
                      <td className="p-3">{inv.billed_to_name}</td>
                      <td className="p-3">{inv.place_of_supply || '-'}</td>
                      <td className="p-3 text-right">₹{inv.sub_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-blue-600">
                        ₹{((inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-medium">₹{inv.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-slate-100 font-bold">
                    <td colSpan={5} className="p-3 text-right">Total:</td>
                    <td className="p-3 text-right">
                      ₹{categorizedData.b2b.reduce((sum, inv) => sum + inv.sub_total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right text-blue-600">
                      ₹{categorizedData.b2b.reduce((sum, inv) => sum + (inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right">₹{summary.b2bTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500">No B2B invoices for this period</p>
          )}
        </CardContent>
      </Card>

      {/* B2CS Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>B2CS Invoices (To Unregistered Dealers)</CardTitle>
        </CardHeader>
        <CardContent>
          {categorizedData.b2cs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left p-3 font-medium">Invoice #</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Customer Name</th>
                    <th className="text-left p-3 font-medium">Place of Supply</th>
                    <th className="text-right p-3 font-medium">Taxable Value</th>
                    <th className="text-right p-3 font-medium">CGST</th>
                    <th className="text-right p-3 font-medium">SGST</th>
                    <th className="text-right p-3 font-medium">IGST</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {categorizedData.b2cs.map(inv => (
                    <tr key={inv.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-medium">#{inv.invoice_number}</td>
                      <td className="p-3">{new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="p-3">{inv.billed_to_name}</td>
                      <td className="p-3">{inv.place_of_supply || '-'}</td>
                      <td className="p-3 text-right">₹{inv.sub_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">{inv.cgst_amount ? `₹${inv.cgst_amount.toFixed(2)}` : '-'}</td>
                      <td className="p-3 text-right">{inv.sgst_amount ? `₹${inv.sgst_amount.toFixed(2)}` : '-'}</td>
                      <td className="p-3 text-right">{inv.igst_amount ? `₹${inv.igst_amount.toFixed(2)}` : '-'}</td>
                      <td className="p-3 text-right font-medium">₹{inv.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-slate-100 font-bold">
                    <td colSpan={4} className="p-3 text-right">Total:</td>
                    <td className="p-3 text-right">
                      ₹{categorizedData.b2cs.reduce((sum, inv) => sum + inv.sub_total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right">
                      ₹{categorizedData.b2cs.reduce((sum, inv) => sum + (inv.cgst_amount || 0), 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-right">
                      ₹{categorizedData.b2cs.reduce((sum, inv) => sum + (inv.sgst_amount || 0), 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-right">
                      ₹{categorizedData.b2cs.reduce((sum, inv) => sum + (inv.igst_amount || 0), 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-right">₹{summary.b2csTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500">No B2CS invoices for this period</p>
          )}
        </CardContent>
      </Card>

      {/* Credit Notes */}
      {filteredCreditNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Credit Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left p-3 font-medium">CN #</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Customer GSTIN</th>
                    <th className="text-left p-3 font-medium">Customer Name</th>
                    <th className="text-left p-3 font-medium">Reason</th>
                    <th className="text-right p-3 font-medium">Taxable Value</th>
                    <th className="text-right p-3 font-medium">Tax</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreditNotes.map(cn => (
                    <tr key={cn.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-medium text-red-600">CN-{cn.credit_note_number}</td>
                      <td className="p-3">{new Date(cn.credit_note_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="p-3 font-mono text-xs">{cn.party_gstin || '-'}</td>
                      <td className="p-3">{cn.party_name}</td>
                      <td className="p-3 text-orange-600">{cn.reason}</td>
                      <td className="p-3 text-right">₹{cn.amount_before_tax?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-blue-600">
                        ₹{((cn.cgst_amount || 0) + (cn.sgst_amount || 0) + (cn.igst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-medium text-red-600">-₹{cn.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
