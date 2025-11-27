'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer } from 'lucide-react'
import { Invoice, InvoiceItem, CompanySettings } from '@/lib/types'

export default function PrintInvoicePage() {
  const params = useParams()
  const router = useRouter()
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
  }, [params.id])

  const handlePrint = () => {
    window.print()
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!invoice || !settings) return <div className="p-8">Invoice not found</div>

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  return (
    <>
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden mb-4 flex gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Invoice
        </Button>
      </div>

      {/* Invoice - Printable */}
      <div className="bg-white print:shadow-none shadow-lg mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '10mm' }}>
        <style jsx global>{`
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: A4; margin: 10mm; }
          }
          .invoice-table { border-collapse: collapse; width: 100%; }
          .invoice-table th, .invoice-table td { border: 1px solid #000; padding: 4px 8px; }
          .invoice-table th { background: #f0f0f0; }
        `}</style>

        {/* Header */}
        <div className="border-2 border-black">
          {/* Company Header */}
          <div className="text-center border-b-2 border-black p-2">
            <div className="flex justify-between items-start">
              <div className="text-xs">GSTIN : {settings.gstin}</div>
              <div className="font-bold text-lg">TAX INVOICE</div>
              <div></div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <div className="w-10 h-10 border border-black rounded-full flex items-center justify-center font-bold text-sm">SP</div>
              <h1 className="text-2xl font-bold">{settings.company_name?.toUpperCase()}</h1>
            </div>
            <p className="text-xs mt-1">MFRS. OF MANUAL AGRICULTURE SPRAY PUMP PLASTIC NOZZLES & PVC PARTS ETC.</p>
            <p className="text-xs">Office Address : {settings.address}</p>
            <p className="text-xs">Ph: {settings.phone} , email. {settings.email}</p>
          </div>

          {/* Invoice Details Row */}
          <div className="grid grid-cols-3 border-b border-black text-sm">
            <div className="border-r border-black p-2">
              <span className="font-semibold">Invoice No.</span> {invoice.invoice_number}
            </div>
            <div className="border-r border-black p-2">
              <span className="font-semibold">Dated</span> {formatDate(invoice.invoice_date)}
            </div>
            <div className="p-2">
              <span className="font-semibold">Party&apos;s GSTIN No.:</span> {invoice.party_gstin || '-'}
            </div>
          </div>

          {/* Billed To / Shipped To */}
          <div className="grid grid-cols-2 border-b border-black text-sm">
            {/* Billed To */}
            <div className="border-r border-black p-2">
              <div className="flex">
                <span className="font-semibold w-20">BILLED TO</span>
                <div className="border border-black px-2 text-xs ml-2">State Code: {invoice.billed_to_state_code || ''}</div>
              </div>
              <div className="mt-1 space-y-1">
                <div><span className="font-semibold">Name</span> {invoice.billed_to_name}</div>
                <div><span className="font-semibold">Address</span> {invoice.billed_to_address || ''}</div>
                <div><span className="font-semibold">State:</span> {invoice.billed_to_state || ''}</div>
              </div>
            </div>
            {/* Shipped To */}
            <div className="p-2">
              <div className="flex">
                <span className="font-semibold w-24">SHIPPED TO</span>
                <div className="border border-black px-2 text-xs ml-2">State Code: {invoice.shipped_to_state_code || ''}</div>
              </div>
              <div className="mt-1 space-y-1">
                <div><span className="font-semibold">Name</span> {invoice.shipped_to_name || ''}</div>
                <div><span className="font-semibold">Address</span> {invoice.shipped_to_address || ''}</div>
                <div><span className="font-semibold">State:</span> {invoice.shipped_to_state || ''}</div>
              </div>
            </div>
          </div>

          {/* Transport Details */}
          <div className="grid grid-cols-6 border-b border-black text-xs">
            <div className="border-r border-black p-1">
              <span className="font-semibold">Transport Mode</span><br/>{invoice.transport_mode || ''}
            </div>
            <div className="border-r border-black p-1">
              <span className="font-semibold">Vehicle No.</span><br/>{invoice.vehicle_number || ''}
            </div>
            <div className="border-r border-black p-1 col-span-2">
              <span className="font-semibold">GR /RR No.</span><br/>{invoice.gr_rr_number || ''}
            </div>
            <div className="border-r border-black p-1">
              <span className="font-semibold">Place of Supply</span><br/>{invoice.place_of_supply || ''}
            </div>
            <div className="p-1">
              <span className="font-semibold">Total Pkg</span><br/>{invoice.total_packages || ''}
            </div>
          </div>

          {/* Items Table */}
          <div className="border-b border-black">
            <table className="invoice-table text-sm">
              <thead>
                <tr>
                  <th className="w-10">S No.</th>
                  <th>DESCRIPTION OF GOODS</th>
                  <th className="w-20">HSN Code</th>
                  <th className="w-16">QTY.</th>
                  <th className="w-14">Unit</th>
                  <th className="w-20">RATE</th>
                  <th className="w-24">RS. AMOUNT P.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="text-center">{index + 1}.</td>
                    <td>{item.description}</td>
                    <td className="text-center">{item.hsn_code || ''}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-center">{item.unit}</td>
                    <td className="text-right">{item.rate?.toFixed(2)}</td>
                    <td className="text-right">{item.amount?.toFixed(2)}</td>
                  </tr>
                ))}
                {/* Empty rows to fill space */}
                {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
                  <tr key={`empty-${i}`}>
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

          {/* Bottom Section */}
          <div className="grid grid-cols-2 text-sm">
            {/* Left - Bank Details */}
            <div className="border-r border-black">
              <div className="p-2 border-b border-black">
                <p><span className="font-semibold">Bank:</span> {settings.bank_name}</p>
                <p><span className="font-semibold">A/c No.</span> {settings.account_number}</p>
                <p><span className="font-semibold">IFSC:</span> {settings.ifsc_code}</p>
              </div>
              <div className="p-2 border-b border-black">
                <p><span className="font-semibold">Total Amount (In Word)</span></p>
                <p className="italic">{invoice.amount_in_words}</p>
              </div>
              <div className="p-2 border-b border-black text-xs">
                <p><span className="font-semibold">Amount of Tax Subject Reversal</span> {invoice.reverse_charge ? 'Yes' : 'No'}</p>
              </div>
              <div className="p-2 text-xs">
                <p className="font-semibold">E.&O.E. Terms & Conditions</p>
                <p>{settings.default_terms}</p>
              </div>
            </div>

            {/* Right - Totals */}
            <div>
              <div className="grid grid-cols-2 border-b border-black">
                <div className="p-2 border-r border-black font-semibold">Total Amount Before Tax</div>
                <div className="p-2 text-right">{invoice.amount_before_tax?.toFixed(2)}</div>
              </div>
              <div className="grid grid-cols-2 border-b border-black">
                <div className="p-2 border-r border-black font-semibold">PKG/ FWDG</div>
                <div className="p-2 text-right">{invoice.packaging_charges?.toFixed(2) || '-'}</div>
              </div>
              <div className="grid grid-cols-2 border-b border-black">
                <div className="p-2 border-r border-black font-semibold">Sub Total</div>
                <div className="p-2 text-right">{invoice.sub_total?.toFixed(2)}</div>
              </div>
              {(invoice.cgst_rate ?? 0) > 0 && (
                <>
                  <div className="grid grid-cols-2 border-b border-black">
                    <div className="p-2 border-r border-black">(+) CGST@ {invoice.cgst_rate}%</div>
                    <div className="p-2 text-right">{invoice.cgst_amount?.toFixed(2)}</div>
                  </div>
                  <div className="grid grid-cols-2 border-b border-black">
                    <div className="p-2 border-r border-black">(+) SGST@ {invoice.sgst_rate}%</div>
                    <div className="p-2 text-right">{invoice.sgst_amount?.toFixed(2)}</div>
                  </div>
                </>
              )}
              {(invoice.igst_rate ?? 0) > 0 && (
                <div className="grid grid-cols-2 border-b border-black">
                  <div className="p-2 border-r border-black">(+) IGST@ {invoice.igst_rate}%</div>
                  <div className="p-2 text-right">{invoice.igst_amount?.toFixed(2)}</div>
                </div>
              )}
              <div className="grid grid-cols-2 border-b border-black font-bold">
                <div className="p-2 border-r border-black">Grand Total</div>
                <div className="p-2 text-right">{invoice.grand_total?.toFixed(2)}</div>
              </div>
              <div className="p-4 text-center">
                <p className="font-bold">For {settings.company_name}</p>
                <div className="h-12"></div>
                <p className="border-t border-black inline-block px-4">Authorised Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
