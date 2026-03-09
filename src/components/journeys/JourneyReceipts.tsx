import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Fuel, CreditCard, ChevronLeft, ChevronRight, ImageOff, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Receipt {
  id: string;
  receipt_url: string;
  type: 'fuel' | 'expense';
  amount: number;
  date: string;
  description?: string;
}

interface JourneyReceiptsProps {
  journeyId: string;
}

export function JourneyReceipts({ journeyId }: JourneyReceiptsProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchReceipts();
  }, [journeyId]);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const [fuelRes, expenseRes] = await Promise.all([
        supabase
          .from('fuel_expenses')
          .select('id, receipt_url, total_amount, date')
          .eq('journey_id', journeyId)
          .not('receipt_url', 'is', null)
          .is('deleted_at', null),
        supabase
          .from('expenses')
          .select('id, receipt_url, amount, date, description')
          .eq('journey_id', journeyId)
          .not('receipt_url', 'is', null)
          .is('deleted_at', null),
      ]);

      const fuelReceipts: Receipt[] = (fuelRes.data || []).map(f => ({
        id: f.id,
        receipt_url: f.receipt_url!,
        type: 'fuel',
        amount: f.total_amount,
        date: f.date,
      }));

      const expenseReceipts: Receipt[] = (expenseRes.data || []).map(e => ({
        id: e.id,
        receipt_url: e.receipt_url!,
        type: 'expense',
        amount: e.amount,
        date: e.date,
        description: e.description,
      }));

      setReceipts([...fuelReceipts, ...expenseReceipts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ImageOff className="h-12 w-12 mb-3" />
        <p className="text-sm font-medium">Nenhum comprovante encontrado</p>
        <p className="text-xs mt-1">Comprovantes de abastecimentos e despesas com foto aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {receipts.map((receipt, index) => (
          <div
            key={receipt.id}
            className="group relative border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            onClick={() => setSelectedIndex(index)}
          >
            <div className="aspect-square bg-muted">
              <img
                src={receipt.receipt_url}
                alt="Comprovante"
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {receipt.type === 'fuel' ? (
                    <><Fuel className="h-2.5 w-2.5 mr-0.5" /> Combustível</>
                  ) : (
                    <><CreditCard className="h-2.5 w-2.5 mr-0.5" /> Despesa</>
                  )}
                </Badge>
              </div>
              <p className="text-white text-xs font-medium mt-1">
                R$ {receipt.amount.toFixed(2)}
              </p>
              <p className="text-white/70 text-[10px]">
                {format(new Date(receipt.date), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selectedIndex !== null && (
            <div className="relative">
              <img
                src={receipts[selectedIndex].receipt_url}
                alt="Comprovante"
                className="w-full max-h-[80vh] object-contain bg-black"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-3 flex items-center justify-between">
                <div className="text-white text-sm">
                  <span className="font-medium">
                    {receipts[selectedIndex].type === 'fuel' ? 'Combustível' : 'Despesa'}
                  </span>
                  {' · '}
                  R$ {receipts[selectedIndex].amount.toFixed(2)}
                  {' · '}
                  {format(new Date(receipts[selectedIndex].date), 'dd/MM/yyyy')}
                </div>
                <div className="text-white/70 text-xs">
                  {selectedIndex + 1} / {receipts.length}
                </div>
              </div>
              {receipts.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full"
                    onClick={(e) => { e.stopPropagation(); setSelectedIndex(i => i !== null ? (i - 1 + receipts.length) % receipts.length : 0); }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full"
                    onClick={(e) => { e.stopPropagation(); setSelectedIndex(i => i !== null ? (i + 1) % receipts.length : 0); }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export helper hook for receipt count
export function useJourneyReceiptCount(journeyId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!journeyId) return;
    
    const fetchCount = async () => {
      const [fuelRes, expenseRes] = await Promise.all([
        supabase
          .from('fuel_expenses')
          .select('id', { count: 'exact', head: true })
          .eq('journey_id', journeyId)
          .not('receipt_url', 'is', null)
          .is('deleted_at', null),
        supabase
          .from('expenses')
          .select('id', { count: 'exact', head: true })
          .eq('journey_id', journeyId)
          .not('receipt_url', 'is', null)
          .is('deleted_at', null),
      ]);
      setCount((fuelRes.count || 0) + (expenseRes.count || 0));
    };
    fetchCount();
  }, [journeyId]);

  return count;
}
