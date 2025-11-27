'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search, FileText, Users, Package, Settings, LayoutDashboard, ReceiptText, BarChart3 } from 'lucide-react'
import { Invoice, Party, Item } from '@/lib/types'

interface SearchResult {
  id: string
  type: 'invoice' | 'party' | 'item' | 'page'
  title: string
  subtitle?: string
  icon: React.ReactNode
  href: string
}

const pages: SearchResult[] = [
  { id: 'dashboard', type: 'page', title: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, href: '/dashboard' },
  { id: 'invoices', type: 'page', title: 'Invoices', icon: <FileText className="h-4 w-4" />, href: '/invoices' },
  { id: 'new-invoice', type: 'page', title: 'New Invoice', subtitle: 'Create a new invoice', icon: <FileText className="h-4 w-4" />, href: '/invoices/new' },
  { id: 'credit-notes', type: 'page', title: 'Credit Notes', icon: <ReceiptText className="h-4 w-4" />, href: '/credit-notes' },
  { id: 'new-credit-note', type: 'page', title: 'New Credit Note', subtitle: 'Create a new credit note', icon: <ReceiptText className="h-4 w-4" />, href: '/credit-notes/new' },
  { id: 'parties', type: 'page', title: 'Parties', icon: <Users className="h-4 w-4" />, href: '/parties' },
  { id: 'new-party', type: 'page', title: 'New Party', subtitle: 'Add a new party', icon: <Users className="h-4 w-4" />, href: '/parties/new' },
  { id: 'items', type: 'page', title: 'Items', icon: <Package className="h-4 w-4" />, href: '/items' },
  { id: 'new-item', type: 'page', title: 'New Item', subtitle: 'Add a new item', icon: <Package className="h-4 w-4" />, href: '/items/new' },
  { id: 'reports', type: 'page', title: 'Reports', icon: <BarChart3 className="h-4 w-4" />, href: '/reports' },
  { id: 'gstr1', type: 'page', title: 'GSTR-1 Export', subtitle: 'Generate GST return data', icon: <BarChart3 className="h-4 w-4" />, href: '/reports/gstr1' },
  { id: 'settings', type: 'page', title: 'Settings', icon: <Settings className="h-4 w-4" />, href: '/settings' },
]

export function CommandPalette() {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Load data when palette opens
  useEffect(() => {
    if (open && !dataLoaded) {
      const loadData = async () => {
        const [invoicesRes, partiesRes, itemsRes] = await Promise.all([
          supabase.from('invoices').select('id, invoice_number, billed_to_name, grand_total').order('invoice_number', { ascending: false }).limit(100),
          supabase.from('parties').select('id, name, gstin').order('name').limit(100),
          supabase.from('items').select('id, name, hsn_code').order('name').limit(100),
        ])

        setInvoices(invoicesRes.data || [])
        setParties(partiesRes.data || [])
        setItems(itemsRes.data || [])
        setDataLoaded(true)
      }
      loadData()
    }
  }, [open, dataLoaded, supabase])

  // Search and filter results
  const searchResults = useCallback(() => {
    const q = query.toLowerCase().trim()

    if (!q) {
      // Show default pages when no query
      return pages.slice(0, 8)
    }

    const results: SearchResult[] = []

    // Search pages
    pages.forEach(page => {
      if (page.title.toLowerCase().includes(q) || page.subtitle?.toLowerCase().includes(q)) {
        results.push(page)
      }
    })

    // Search invoices
    invoices.forEach(inv => {
      const matchesNumber = inv.invoice_number?.toString().includes(q)
      const matchesName = inv.billed_to_name?.toLowerCase().includes(q)

      if (matchesNumber || matchesName) {
        results.push({
          id: `invoice-${inv.id}`,
          type: 'invoice',
          title: `Invoice #${inv.invoice_number}`,
          subtitle: `${inv.billed_to_name} - ₹${inv.grand_total?.toLocaleString('en-IN')}`,
          icon: <FileText className="h-4 w-4" />,
          href: `/invoices/${inv.id}`,
        })
      }
    })

    // Search parties
    parties.forEach(party => {
      const matchesName = party.name?.toLowerCase().includes(q)
      const matchesGstin = party.gstin?.toLowerCase().includes(q)

      if (matchesName || matchesGstin) {
        results.push({
          id: `party-${party.id}`,
          type: 'party',
          title: party.name,
          subtitle: party.gstin || 'No GSTIN',
          icon: <Users className="h-4 w-4" />,
          href: `/parties/${party.id}`,
        })
      }
    })

    // Search items
    items.forEach(item => {
      const matchesName = item.name?.toLowerCase().includes(q)
      const matchesHsn = item.hsn_code?.toLowerCase().includes(q)

      if (matchesName || matchesHsn) {
        results.push({
          id: `item-${item.id}`,
          type: 'item',
          title: item.name,
          subtitle: item.hsn_code ? `HSN: ${item.hsn_code}` : undefined,
          icon: <Package className="h-4 w-4" />,
          href: `/items/${item.id}`,
        })
      }
    })

    return results.slice(0, 15)
  }, [query, invoices, parties, items])

  useEffect(() => {
    setResults(searchResults())
    setSelectedIndex(0)
  }, [searchResults])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    }
  }

  const handleSelect = (result: SearchResult) => {
    router.push(result.href)
    setOpen(false)
    setQuery('')
  }

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = []
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  const typeLabels: Record<string, string> = {
    page: 'Pages',
    invoice: 'Invoices',
    party: 'Parties',
    item: 'Items',
  }

  let globalIndex = -1

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-slate-400 mr-2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search invoices, parties, items..."
            className="border-0 focus-visible:ring-0 py-4 text-base"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-600">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length > 0 ? (
            Object.entries(groupedResults).map(([type, typeResults]) => (
              <div key={type}>
                <p className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {typeLabels[type]}
                </p>
                {typeResults.map((result) => {
                  globalIndex++
                  const isSelected = globalIndex === selectedIndex
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                        isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                      }`}
                    >
                      <span className={isSelected ? 'text-white' : 'text-slate-400'}>
                        {result.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {result.title}
                        </p>
                        {result.subtitle && (
                          <p className={`text-sm truncate ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded bg-slate-700 px-1.5 font-mono text-[10px] font-medium text-slate-300">
                          Enter
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          ) : (
            <p className="text-center py-8 text-slate-500">
              No results found for &quot;{query}&quot;
            </p>
          )}
        </div>

        <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <kbd className="h-5 inline-flex items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-600">
              ↑↓
            </kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="h-5 inline-flex items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-600">
              ⏎
            </kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="h-5 inline-flex items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-600">
              ⌘K
            </kbd>
            <span>Open</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
