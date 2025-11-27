'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Save, Printer, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Party, Item, Invoice, CompanySettings, INDIAN_STATES, UNITS, CREDIT_NOTE_REASONS } from '@/lib/types'
import { amountToWords } from '@/lib/amount-to-words'

interface LineItem {
  id: string
  item_id: string | null
  description: string
  hsn_code: string
  quantity: string
  unit: string
  rate: string
  amount: number
}

const emptyLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  item_id: null,
  description: '',
  hsn_code: '',
  quantity: '',
  unit: 'Pc',
  rate: '',
  amount: 0,
})

export default function NewCreditNotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Data for autocomplete
  const [parties, setParties] = useState<Party[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Party search
  const [partySearch, setPartySearch] = useState('')
  const [showPartyDropdown, setShowPartyDropdown] = useState(false)
  const [itemSearchIndex, setItemSearchIndex] = useState<number | null>(null)

  // Form state
  const [creditNoteNumber, setCreditNoteNumber] = useState<number>(0)
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [originalInvoiceId, setOriginalInvoiceId] = useState<string>('')
  const [partyGstin, setPartyGstin] = useState('')
  const [reason, setReason] = useState<string>('')

  // Party
  const [party, setParty] = useState({
    party_id: '',
    name: '',
    address: '',
    state: '',
    state_code: '',
  })

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()])

  // Notes
  const [notes, setNotes] = useState('')

  // Calculated values
  const [totals, setTotals] = useState({
    amountBeforeTax: 0,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    totalAmount: 0,
    amountInWords: '',
  })

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      const [partiesRes, itemsRes, settingsRes, invoicesRes] = await Promise.all([
        supabase.from('parties').select('*').order('name'),
        supabase.from('items').select('*').order('name'),
        supabase.from('company_settings').select('*').eq('id', 1).single(),
        supabase.from('invoices').select('*').order('invoice_number', { ascending: false }),
      ])

      if (partiesRes.data) setParties(partiesRes.data)
      if (itemsRes.data) setItems(itemsRes.data)
      if (invoicesRes.data) setInvoices(invoicesRes.data)
      if (settingsRes.data) {
        setSettings(settingsRes.data)
        setCreditNoteNumber(settingsRes.data.next_credit_note_number || 1)
      }

      // Pre-select invoice if provided in URL
      const invoiceId = searchParams.get('invoice')
      if (invoiceId && invoicesRes.data) {
        const invoice = invoicesRes.data.find(i => i.id === invoiceId)
        if (invoice) {
          setOriginalInvoiceId(invoice.id)
          setParty({
            party_id: invoice.party_id || '',
            name: invoice.billed_to_name,
            address: invoice.billed_to_address || '',
            state: invoice.billed_to_state || '',
            state_code: invoice.billed_to_state_code || '',
          })
          setPartySearch(invoice.billed_to_name)
          setPartyGstin(invoice.party_gstin || '')
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [searchParams])

  // Calculate totals whenever line items change
  const calculateTotals = useCallback(() => {
    const amountBeforeTax = lineItems.reduce((sum, item) => sum + item.amount, 0)

    // Determine GST type based on state
    const companyStateCode = settings?.state_code || '07'
    const supplyStateCode = party.state_code || companyStateCode

    // Get GST rate (use first item's rate or default)
    const gstRate = items.find(i => lineItems.some(li => li.item_id === i.id))?.gst_rate || settings?.default_gst_rate || 18

    let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0

    if (supplyStateCode === companyStateCode) {
      // Intra-state: CGST + SGST
      cgstRate = gstRate / 2
      sgstRate = gstRate / 2
      cgstAmount = Math.round((amountBeforeTax * cgstRate / 100) * 100) / 100
      sgstAmount = Math.round((amountBeforeTax * sgstRate / 100) * 100) / 100
    } else {
      // Inter-state: IGST
      igstRate = gstRate
      igstAmount = Math.round((amountBeforeTax * igstRate / 100) * 100) / 100
    }

    const totalAmount = Math.round((amountBeforeTax + cgstAmount + sgstAmount + igstAmount) * 100) / 100

    setTotals({
      amountBeforeTax,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      totalAmount,
      amountInWords: amountToWords(totalAmount),
    })
  }, [lineItems, party.state_code, settings, items])

  useEffect(() => {
    calculateTotals()
  }, [calculateTotals])

  // Party selection
  const handlePartySelect = (selectedParty: Party) => {
    setParty({
      party_id: selectedParty.id,
      name: selectedParty.name,
      address: selectedParty.address || '',
      state: selectedParty.state || '',
      state_code: selectedParty.state_code || '',
    })
    setPartyGstin(selectedParty.gstin || '')
    setPartySearch(selectedParty.name)
    setShowPartyDropdown(false)

    // Filter invoices for this party
    setOriginalInvoiceId('')
  }

  // Line item handlers
  const handleItemSelect = (index: number, item: Item) => {
    const newItems = [...lineItems]
    newItems[index] = {
      ...newItems[index],
      item_id: item.id,
      description: item.name,
      hsn_code: item.hsn_code || '',
      unit: item.default_unit,
      rate: item.default_rate?.toString() || '',
    }

    // Calculate amount
    const qty = parseFloat(newItems[index].quantity) || 0
    const rate = parseFloat(newItems[index].rate) || 0
    newItems[index].amount = Math.round(qty * rate * 100) / 100

    setLineItems(newItems)
    setItemSearchIndex(null)
  }

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const newItems = [...lineItems]
    newItems[index] = { ...newItems[index], [field]: value }

    // Recalculate amount
    if (field === 'quantity' || field === 'rate') {
      const qty = parseFloat(field === 'quantity' ? value : newItems[index].quantity) || 0
      const rate = parseFloat(field === 'rate' ? value : newItems[index].rate) || 0
      newItems[index].amount = Math.round(qty * rate * 100) / 100
    }

    setLineItems(newItems)
  }

  const addLineItem = () => {
    setLineItems([...lineItems, emptyLineItem()])
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  // Save credit note
  const handleSave = async (andPrint: boolean = false) => {
    // Validation
    if (!party.name.trim()) {
      toast.error('Please enter party name')
      return
    }

    if (!reason) {
      toast.error('Please select a reason')
      return
    }

    const validLineItems = lineItems.filter(li => li.description.trim() && li.quantity && li.rate)
    if (validLineItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    setSaving(true)

    try {
      // Create credit note
      const { data: creditNote, error: creditNoteError } = await supabase
        .from('credit_notes')
        .insert({
          credit_note_number: creditNoteNumber,
          credit_note_date: creditNoteDate,
          original_invoice_id: originalInvoiceId || null,
          party_id: party.party_id || null,
          party_gstin: partyGstin || null,
          party_name: party.name,
          party_address: party.address || null,
          party_state: party.state || null,
          party_state_code: party.state_code || null,
          reason: reason,
          amount_before_tax: totals.amountBeforeTax,
          cgst_rate: totals.cgstRate || null,
          cgst_amount: totals.cgstAmount || null,
          sgst_rate: totals.sgstRate || null,
          sgst_amount: totals.sgstAmount || null,
          igst_rate: totals.igstRate || null,
          igst_amount: totals.igstAmount || null,
          total_amount: totals.totalAmount,
          amount_in_words: totals.amountInWords,
          notes: notes || null,
        })
        .select()
        .single()

      if (creditNoteError) throw creditNoteError

      // Create line items
      const lineItemsToInsert = validLineItems.map((li, index) => ({
        credit_note_id: creditNote.id,
        serial_number: index + 1,
        item_id: li.item_id || null,
        description: li.description,
        hsn_code: li.hsn_code || null,
        quantity: parseFloat(li.quantity),
        unit: li.unit,
        rate: parseFloat(li.rate),
        amount: li.amount,
      }))

      const { error: itemsError } = await supabase
        .from('credit_note_items')
        .insert(lineItemsToInsert)

      if (itemsError) throw itemsError

      // Update next credit note number
      await supabase
        .from('company_settings')
        .update({ next_credit_note_number: creditNoteNumber + 1 })
        .eq('id', 1)

      toast.success('Credit note saved successfully')

      if (andPrint) {
        window.open(`/print/credit-note/${creditNote.id}`, '_blank')
      }
      router.push('/credit-notes')
    } catch (error: unknown) {
      console.error('Error saving credit note:', error)
      const err = error as { message?: string; code?: string }

      if (err?.code === '23505' || err?.message?.includes('duplicate') || err?.message?.includes('unique')) {
        toast.error(`Credit Note #${creditNoteNumber} already exists. Please use a different number.`)
      } else {
        toast.error(err?.message || 'Failed to save credit note')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  const filteredParties = parties.filter(p =>
    p.name.toLowerCase().includes(partySearch.toLowerCase())
  )

  const partyInvoices = invoices.filter(inv =>
    !party.party_id || inv.party_id === party.party_id
  )

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/credit-notes')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">New Credit Note</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            <Printer className="mr-2 h-4 w-4" />
            Save & Print
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Credit Note Header */}
        <Card>
          <CardHeader>
            <CardTitle>Credit Note Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Credit Note No.</Label>
                <Input
                  value={creditNoteNumber}
                  onChange={(e) => setCreditNoteNumber(parseInt(e.target.value) || 0)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={creditNoteDate}
                  onChange={(e) => setCreditNoteDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Original Invoice</Label>
                <Select value={originalInvoiceId} onValueChange={setOriginalInvoiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {partyInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        #{inv.invoice_number} - {inv.billed_to_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Party GSTIN</Label>
                <Input
                  value={partyGstin}
                  onChange={(e) => setPartyGstin(e.target.value.toUpperCase())}
                  placeholder="e.g., 27AABCU9603R1ZM"
                  maxLength={15}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Party Details */}
        <Card>
          <CardHeader>
            <CardTitle>Party Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <Label>Name *</Label>
                <Input
                  value={partySearch}
                  onChange={(e) => {
                    setPartySearch(e.target.value)
                    setParty({ ...party, name: e.target.value })
                    setShowPartyDropdown(true)
                  }}
                  onFocus={() => setShowPartyDropdown(true)}
                  placeholder="Search or enter party name"
                />
                {showPartyDropdown && partySearch && filteredParties.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                    {filteredParties.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        className="px-3 py-2 cursor-pointer hover:bg-slate-100"
                        onClick={() => handlePartySelect(p)}
                      >
                        <p className="font-medium">{p.name}</p>
                        {p.gstin && <p className="text-sm text-slate-500">{p.gstin}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={party.address}
                  onChange={(e) => setParty({ ...party, address: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>State</Label>
                <Select
                  value={party.state_code}
                  onValueChange={(code) => {
                    const state = INDIAN_STATES.find(s => s.code === code)
                    setParty({ ...party, state: state?.name || '', state_code: code })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.code} - {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>State Code</Label>
                <Input value={party.state_code} disabled />
              </div>
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDIT_NOTE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card className="overflow-visible">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="overflow-visible">
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 w-8">#</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-left p-2 w-24">HSN</th>
                    <th className="text-right p-2 w-20">Qty</th>
                    <th className="text-left p-2 w-20">Unit</th>
                    <th className="text-right p-2 w-24">Rate</th>
                    <th className="text-right p-2 w-28">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">{index + 1}</td>
                      <td className="p-2 relative">
                        <Input
                          value={item.description}
                          onChange={(e) => {
                            updateLineItem(index, 'description', e.target.value)
                            setItemSearchIndex(index)
                          }}
                          onFocus={() => setItemSearchIndex(index)}
                          placeholder="Search or enter item"
                        />
                        {itemSearchIndex === index && item.description && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                            {items
                              .filter(i => i.name.toLowerCase().includes(item.description.toLowerCase()))
                              .slice(0, 10)
                              .map((i) => (
                                <div
                                  key={i.id}
                                  className="px-3 py-2 cursor-pointer hover:bg-slate-100"
                                  onClick={() => handleItemSelect(index, i)}
                                >
                                  <p className="font-medium">{i.name}</p>
                                  <p className="text-sm text-slate-500">
                                    HSN: {i.hsn_code || '-'} | ₹{i.default_rate || 0}
                                  </p>
                                </div>
                              ))}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.hsn_code}
                          onChange={(e) => updateLineItem(index, 'hsn_code', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.001"
                          className="text-right"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <Select
                          value={item.unit}
                          onValueChange={(value) => updateLineItem(index, 'unit', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS.map((unit) => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="text-right"
                          value={item.rate}
                          onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Additional Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Notes (Internal)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Amount Before Tax</span>
                  <span>₹{totals.amountBeforeTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {totals.cgstRate > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>CGST @ {totals.cgstRate}%</span>
                      <span>₹{totals.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST @ {totals.sgstRate}%</span>
                      <span>₹{totals.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                {totals.igstRate > 0 && (
                  <div className="flex justify-between">
                    <span>IGST @ {totals.igstRate}%</span>
                    <span>₹{totals.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2 text-red-600">
                  <span>Total Credit Amount</span>
                  <span>₹{totals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-sm text-slate-600 border-t pt-2">
                  <strong>In Words:</strong> {totals.amountInWords}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
