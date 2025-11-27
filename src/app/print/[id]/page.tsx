'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Invoice, InvoiceItem, CompanySettings } from '@/lib/types'

export default function PrintInvoicePage() {
  const params = useParams()
  const supabase = createClient()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [invoiceRes, itemsRes, settingsRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', params.id).single(),
        supabase.from('invoice_items').select('*').eq('invoice_id', params.id).order('serial_number'),
        supabase.from('company_settings').select('*').eq('id', 1).single(),
      ])

      if (invoiceRes.data) setInvoice(invoiceRes.data)
      if (itemsRes.data) setItems(itemsRes.data)
      if (settingsRes.data) setSettings(settingsRes.data)
      setLoading(false)
    }

    fetchData()
  }, [params.id, supabase])

  // Auto-print when loaded
  useEffect(() => {
    if (!loading && invoice && settings) {
      setTimeout(() => {
        window.print()
      }, 500)
    }
  }, [loading, invoice, settings])

  if (loading) return <div className="p-8 text-center">Loading invoice...</div>
  if (!invoice || !settings) return <div className="p-8 text-center">Invoice not found</div>

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
        .invoice-page {
          width: 210mm;
          min-height: 287mm;
          padding: 12mm;
          box-sizing: border-box;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }
        .invoice-wrapper {
          display: flex;
          flex-direction: column;
          min-height: calc(287mm - 24mm);
          border: 1px solid #d1d5db;
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
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          color: #475569;
        }
        .items-table td {
          border-bottom: 1px solid #f1f5f9;
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
        <span className="text-sm text-gray-600 font-medium">Invoice #{invoice.invoice_number}</span>
        <div className="flex gap-3">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Print Invoice
          </button>
        </div>
      </div>

      {/* Invoice */}
      <div className="invoice-page mx-auto bg-white shadow-sm my-4 print:my-0 print:shadow-none">
        <div className="invoice-wrapper">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
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
                <div className="inline-block px-4 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded tracking-wide">
                  TAX INVOICE
                </div>
                <div className="mt-4 text-[11px] space-y-1">
                  <p><span className="text-gray-500">Invoice No:</span> <span className="font-semibold text-gray-900">{invoice.invoice_number}</span></p>
                  <p><span className="text-gray-500">Date:</span> <span className="font-medium">{formatDate(invoice.invoice_date)}</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To / Shipped To */}
          <div className="grid grid-cols-2 border-b border-gray-200">
            <div className="p-4 border-r border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
              <p className="font-semibold text-gray-900 text-sm">{invoice.billed_to_name}</p>
              <p className="text-[11px] text-gray-600 mt-1">{invoice.billed_to_address || ''}</p>
              <p className="text-[11px] text-gray-600">{invoice.billed_to_state || ''} {invoice.billed_to_state_code ? `(${invoice.billed_to_state_code})` : ''}</p>
              {invoice.party_gstin && <p className="text-[11px] text-gray-700 mt-1 font-medium">GSTIN: {invoice.party_gstin}</p>}
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Ship To</p>
              <p className="font-semibold text-gray-900 text-sm">{invoice.shipped_to_name || invoice.billed_to_name}</p>
              <p className="text-[11px] text-gray-600 mt-1">{invoice.shipped_to_address || invoice.billed_to_address || ''}</p>
              <p className="text-[11px] text-gray-600">{invoice.shipped_to_state || invoice.billed_to_state || ''} {invoice.shipped_to_state_code ? `(${invoice.shipped_to_state_code})` : ''}</p>
            </div>
          </div>

          {/* Transport Details */}
          <div className="grid grid-cols-5 border-b border-gray-200 bg-gray-50 text-[10px]">
            <div className="p-3 border-r border-gray-100">
              <p className="text-gray-400 uppercase tracking-wide text-[9px]">Transport</p>
              <p className="font-medium text-gray-700 mt-0.5">{invoice.transport_mode || '-'}</p>
            </div>
            <div className="p-3 border-r border-gray-100">
              <p className="text-gray-400 uppercase tracking-wide text-[9px]">Vehicle No.</p>
              <p className="font-medium text-gray-700 mt-0.5">{invoice.vehicle_number || '-'}</p>
            </div>
            <div className="p-3 border-r border-gray-100">
              <p className="text-gray-400 uppercase tracking-wide text-[9px]">GR/RR No.</p>
              <p className="font-medium text-gray-700 mt-0.5">{invoice.gr_rr_number || '-'}</p>
            </div>
            <div className="p-3 border-r border-gray-100">
              <p className="text-gray-400 uppercase tracking-wide text-[9px]">Place of Supply</p>
              <p className="font-medium text-gray-700 mt-0.5">{invoice.place_of_supply || '-'}</p>
            </div>
            <div className="p-3">
              <p className="text-gray-400 uppercase tracking-wide text-[9px]">Packages</p>
              <p className="font-medium text-gray-700 mt-0.5">{invoice.total_packages || '-'}</p>
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
          <div className="border-t border-gray-200">
            <div className="grid grid-cols-2">
              {/* Left Side - Bank & Terms */}
              <div className="border-r border-gray-100 text-[10px]">
                <div className="p-4 border-b border-gray-100">
                  <p className="text-gray-400 uppercase tracking-wider text-[9px] mb-2">Bank Details</p>
                  <p className="text-gray-700"><span className="text-gray-500">Bank:</span> {settings.bank_name}</p>
                  <p className="text-gray-700"><span className="text-gray-500">A/C:</span> {settings.account_number}</p>
                  <p className="text-gray-700"><span className="text-gray-500">IFSC:</span> {settings.ifsc_code}</p>
                </div>
                <div className="p-4 border-b border-gray-100">
                  <p className="text-gray-400 uppercase tracking-wider text-[9px] mb-1">Amount in Words</p>
                  <p className="text-gray-700 italic">{invoice.amount_in_words}</p>
                </div>
                <div className="p-4">
                  <p className="text-gray-400 uppercase tracking-wider text-[9px] mb-1">Terms & Conditions</p>
                  <p className="text-gray-500 leading-relaxed">{settings.default_terms}</p>
                  <p className="text-gray-500 mt-1">Tax Subject to Reverse Charge: {invoice.reverse_charge ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {/* Right Side - Totals */}
              <div className="text-[11px]">
                <div className="flex justify-between p-3 border-b border-gray-100">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{invoice.amount_before_tax?.toFixed(2)}</span>
                </div>
                {(invoice.packaging_charges ?? 0) > 0 && (
                  <div className="flex justify-between p-3 border-b border-gray-100">
                    <span className="text-gray-600">Packaging / Forwarding</span>
                    <span>₹{invoice.packaging_charges?.toFixed(2)}</span>
                  </div>
                )}
                {(invoice.cgst_rate ?? 0) > 0 && (
                  <>
                    <div className="flex justify-between p-3 border-b border-gray-100">
                      <span className="text-gray-600">CGST @ {invoice.cgst_rate}%</span>
                      <span>₹{invoice.cgst_amount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-gray-100">
                      <span className="text-gray-600">SGST @ {invoice.sgst_rate}%</span>
                      <span>₹{invoice.sgst_amount?.toFixed(2)}</span>
                    </div>
                  </>
                )}
                {(invoice.igst_rate ?? 0) > 0 && (
                  <div className="flex justify-between p-3 border-b border-gray-100">
                    <span className="text-gray-600">IGST @ {invoice.igst_rate}%</span>
                    <span>₹{invoice.igst_amount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between p-4 bg-gray-900 text-white">
                  <span className="font-semibold">Grand Total</span>
                  <span className="font-bold text-base">₹ {invoice.grand_total?.toFixed(2)}</span>
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
