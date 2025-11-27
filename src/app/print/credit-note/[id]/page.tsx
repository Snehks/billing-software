'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CreditNote, CreditNoteItem, CompanySettings, Invoice } from '@/lib/types'

export default function PrintCreditNotePage() {
  const params = useParams()
  const supabase = createClient()

  const [creditNote, setCreditNote] = useState<CreditNote | null>(null)
  const [items, setItems] = useState<CreditNoteItem[]>([])
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [originalInvoice, setOriginalInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [creditNoteRes, itemsRes, settingsRes] = await Promise.all([
        supabase.from('credit_notes').select('*').eq('id', params.id).single(),
        supabase.from('credit_note_items').select('*').eq('credit_note_id', params.id).order('serial_number'),
        supabase.from('company_settings').select('*').eq('id', 1).single(),
      ])

      if (creditNoteRes.data) {
        setCreditNote(creditNoteRes.data)

        // Fetch original invoice if linked
        if (creditNoteRes.data.original_invoice_id) {
          const { data: invoiceData } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', creditNoteRes.data.original_invoice_id)
            .single()
          if (invoiceData) setOriginalInvoice(invoiceData)
        }
      }
      if (itemsRes.data) setItems(itemsRes.data)
      if (settingsRes.data) setSettings(settingsRes.data)
      setLoading(false)
    }

    fetchData()
  }, [params.id, supabase])

  // Auto-print when loaded
  useEffect(() => {
    if (!loading && creditNote && settings) {
      setTimeout(() => {
        window.print()
      }, 500)
    }
  }, [loading, creditNote, settings])

  if (loading) return <div className="p-8 text-center">Loading credit note...</div>
  if (!creditNote || !settings) return <div className="p-8 text-center">Credit note not found</div>

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  // Calculate empty rows needed to fill A4 page
  const TARGET_ROWS = 10
  const emptyRowsCount = Math.max(0, TARGET_ROWS - items.length)

  return (
    <div className="bg-gray-100 min-h-screen">
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; background: white; }
          @page { size: A4; margin: 10mm; }
          .no-print { display: none !important; }
        }
        .credit-note-page {
          width: 210mm;
          min-height: 287mm;
          padding: 12mm;
          box-sizing: border-box;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }
        .credit-note-wrapper {
          display: flex;
          flex-direction: column;
          min-height: calc(287mm - 24mm);
          border: 2px solid #dc2626;
          border-radius: 2px;
        }
        .items-section {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .items-table {
          border-collapse: collapse;
          width: 100%;
          flex: 1;
        }
        .items-table th {
          background: #fef2f2;
          border-bottom: 1px solid #fecaca;
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          color: #991b1b;
        }
        .items-table td {
          border-bottom: 1px solid #fef2f2;
          padding: 10px 12px;
          font-size: 11px;
          color: #334155;
        }
        .items-table tr:last-child td {
          border-bottom: none;
        }
        .items-table .empty-row td {
          height: 28px;
        }
      `}</style>

      {/* Print Button - Hidden when printing */}
      <div className="no-print p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <span className="text-sm text-gray-600 font-medium">Credit Note CN-{creditNote.credit_note_number}</span>
        <div className="flex gap-3">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Print Credit Note
          </button>
        </div>
      </div>

      {/* Credit Note */}
      <div className="credit-note-page mx-auto bg-white shadow-sm my-4 print:my-0 print:shadow-none">
        <div className="credit-note-wrapper">
          {/* Header */}
          <div className="p-6 border-b border-red-200 bg-red-50">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    SP
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900 tracking-tight">{settings.company_name?.toUpperCase()}</h1>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Mfrs. of Agriculture Spray Pump Plastic Nozzles & PVC Parts</p>
                  </div>
                </div>
                <div className="text-[11px] text-gray-600 mt-3 space-y-0.5">
                  <p>{settings.address}</p>
                  <p>Ph: {settings.phone} | {settings.email}</p>
                  <p className="font-medium text-gray-700">GSTIN: {settings.gstin}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded tracking-wide">
                  CREDIT NOTE
                </div>
                <div className="mt-4 text-[11px] space-y-1">
                  <p><span className="text-gray-500">Credit Note No:</span> <span className="font-semibold text-gray-900">CN-{creditNote.credit_note_number}</span></p>
                  <p><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(creditNote.credit_note_date)}</span></p>
                  {originalInvoice && (
                    <p><span className="text-gray-500">Original Invoice:</span> <span className="font-medium">#{originalInvoice.invoice_number}</span></p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Party Details */}
          <div className="p-4 border-b border-red-100">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Credit To</p>
                <p className="font-semibold text-gray-900 text-sm">{creditNote.party_name}</p>
                <p className="text-[11px] text-gray-600 mt-1">{creditNote.party_address || ''}</p>
                <p className="text-[11px] text-gray-600">{creditNote.party_state || ''} {creditNote.party_state_code ? `(${creditNote.party_state_code})` : ''}</p>
                {creditNote.party_gstin && <p className="text-[11px] text-gray-700 mt-1 font-medium">GSTIN: {creditNote.party_gstin}</p>}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Reason for Credit</p>
                <p className="text-sm font-medium text-red-600">{creditNote.reason}</p>
                {originalInvoice && (
                  <div className="mt-2 text-[11px] text-gray-600">
                    <p>Against Invoice #{originalInvoice.invoice_number}</p>
                    <p>Dated: {formatDate(originalInvoice.invoice_date)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="items-section">
            <table className="items-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">#</th>
                  <th className="text-left">Description</th>
                  <th className="w-16 text-center">HSN</th>
                  <th className="w-14 text-right">Qty</th>
                  <th className="w-12 text-center">Unit</th>
                  <th className="w-16 text-right">Rate</th>
                  <th className="w-20 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="text-center text-gray-400">{index + 1}</td>
                    <td className="font-medium">{item.description}</td>
                    <td className="text-center text-gray-500">{item.hsn_code || '-'}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-center text-gray-500">{item.unit}</td>
                    <td className="text-right">₹{item.rate?.toFixed(2)}</td>
                    <td className="text-right font-medium">₹{item.amount?.toFixed(2)}</td>
                  </tr>
                ))}
                {/* Empty rows to fill the page */}
                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                  <tr key={`empty-${i}`} className="empty-row">
                    <td>&nbsp;</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Section */}
          <div className="border-t border-red-200">
            <div className="grid grid-cols-2">
              {/* Left Side - Bank & Terms */}
              <div className="border-r border-red-100 text-[10px]">
                <div className="p-4 border-b border-red-100">
                  <p className="text-gray-400 uppercase tracking-wider text-[9px] mb-2">Bank Details</p>
                  <p className="text-gray-700"><span className="text-gray-500">Bank:</span> {settings.bank_name}</p>
                  <p className="text-gray-700"><span className="text-gray-500">A/C:</span> {settings.account_number}</p>
                  <p className="text-gray-700"><span className="text-gray-500">IFSC:</span> {settings.ifsc_code}</p>
                </div>
                <div className="p-4 border-b border-red-100">
                  <p className="text-gray-400 uppercase tracking-wider text-[9px] mb-1">Amount in Words</p>
                  <p className="text-gray-700 italic">{creditNote.amount_in_words}</p>
                </div>
                <div className="p-4">
                  <p className="text-gray-400 uppercase tracking-wider text-[9px] mb-1">Note</p>
                  <p className="text-gray-500 leading-relaxed">
                    This credit note reduces the amount payable against the original invoice.
                    {creditNote.notes && <><br/>{creditNote.notes}</>}
                  </p>
                </div>
              </div>

              {/* Right Side - Totals */}
              <div className="text-[11px]">
                <div className="flex justify-between p-3 border-b border-red-100">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{creditNote.amount_before_tax?.toFixed(2)}</span>
                </div>
                {(creditNote.cgst_rate ?? 0) > 0 && (
                  <>
                    <div className="flex justify-between p-3 border-b border-red-100">
                      <span className="text-gray-600">CGST @ {creditNote.cgst_rate}%</span>
                      <span>₹{creditNote.cgst_amount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-red-100">
                      <span className="text-gray-600">SGST @ {creditNote.sgst_rate}%</span>
                      <span>₹{creditNote.sgst_amount?.toFixed(2)}</span>
                    </div>
                  </>
                )}
                {(creditNote.igst_rate ?? 0) > 0 && (
                  <div className="flex justify-between p-3 border-b border-red-100">
                    <span className="text-gray-600">IGST @ {creditNote.igst_rate}%</span>
                    <span>₹{creditNote.igst_amount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between p-4 bg-red-600 text-white">
                  <span className="font-semibold">Total Credit Amount</span>
                  <span className="font-bold text-base">₹ {creditNote.total_amount?.toFixed(2)}</span>
                </div>
                <div className="p-4 text-center">
                  <p className="text-[10px] text-gray-500 mb-8">For {settings.company_name}</p>
                  <div className="inline-block">
                    <div className="w-32 border-t border-gray-300 pt-1">
                      <p className="text-[9px] text-gray-400">Authorised Signatory</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
