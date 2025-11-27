'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Package, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Item, UNITS, GST_RATES } from '@/lib/types'

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    hsn_code: '',
    default_unit: 'Pc',
    default_rate: '',
    gst_rate: '18',
  })

  const supabase = createClient()

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('name')

    if (error) {
      toast.error('Failed to fetch items')
      return
    }

    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const resetForm = () => {
    setFormData({
      name: '',
      hsn_code: '',
      default_unit: 'Pc',
      default_rate: '',
      gst_rate: '18',
    })
    setEditingItem(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      name: formData.name,
      hsn_code: formData.hsn_code || null,
      default_unit: formData.default_unit,
      default_rate: formData.default_rate ? parseFloat(formData.default_rate) : null,
      gst_rate: parseFloat(formData.gst_rate),
    }

    if (editingItem) {
      const { error } = await supabase
        .from('items')
        .update(payload)
        .eq('id', editingItem.id)

      if (error) {
        toast.error('Failed to update item')
        return
      }

      toast.success('Item updated')
    } else {
      const { error } = await supabase
        .from('items')
        .insert(payload)

      if (error) {
        toast.error('Failed to add item')
        return
      }

      toast.success('Item added')
    }

    setDialogOpen(false)
    resetForm()
    fetchItems()
  }

  const handleEdit = (item: Item) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      hsn_code: item.hsn_code || '',
      default_unit: item.default_unit,
      default_rate: item.default_rate?.toString() || '',
      gst_rate: item.gst_rate.toString(),
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete item')
      return
    }

    toast.success('Item deleted')
    fetchItems()
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Items</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Agricultural Spray Pump PVC Nozzle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hsn_code">HSN Code</Label>
                <Input
                  id="hsn_code"
                  value={formData.hsn_code}
                  onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                  placeholder="e.g., 8424"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default_unit">Default Unit</Label>
                  <Select
                    value={formData.default_unit}
                    onValueChange={(value) => setFormData({ ...formData, default_unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst_rate">GST Rate %</Label>
                  <Select
                    value={formData.gst_rate}
                    onValueChange={(value) => setFormData({ ...formData, gst_rate: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GST_RATES.map((rate) => (
                        <SelectItem key={rate} value={rate.toString()}>
                          {rate}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_rate">Default Rate (₹)</Label>
                <Input
                  id="default_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.default_rate}
                  onChange={(e) => setFormData({ ...formData, default_rate: e.target.value })}
                  placeholder="e.g., 4.30"
                />
              </div>
              <Button type="submit" className="w-full">
                {editingItem ? 'Update Item' : 'Add Item'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-slate-500">
                      {item.hsn_code && <span className="mr-3">HSN: {item.hsn_code}</span>}
                      <span className="mr-3">{item.default_unit}</span>
                      <span>GST: {item.gst_rate}%</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {item.default_rate && (
                      <span className="font-medium">₹{item.default_rate}</span>
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-2 text-sm font-medium text-slate-900">No items yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add your products/items to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
