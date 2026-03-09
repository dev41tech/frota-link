import { supabase } from '@/integrations/supabase/client';

const DB_NAME = 'DriverExpensesDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingExpenses';

// Lock para evitar sincronizações paralelas
let isSyncing = false;

interface PendingExpense {
  id: string;
  type: 'fuel' | 'expense';
  data: any & {
    location_lat?: number;
    location_lng?: number;
    location_address?: string;
  };
  photoBase64?: string;
  timestamp: number;
}

// Inicializar IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Salvar lançamento offline
export async function saveOfflineExpense(type: 'fuel' | 'expense', data: any, photoBase64?: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  const expense: PendingExpense = {
    id: crypto.randomUUID(),
    type,
    data,
    photoBase64,
    timestamp: Date.now()
  };
  
  await store.add(expense);
}

// Obter lançamentos pendentes
export async function getPendingExpenses(): Promise<PendingExpense[]> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Verificar se registro duplicado já existe no Supabase
async function checkDuplicate(expense: PendingExpense): Promise<boolean> {
  const amountValue = expense.type === 'fuel' ? expense.data.total_amount : expense.data.amount;
  
  // Tolerância de 2 minutos para detectar duplicados
  const minDate = new Date(expense.timestamp - 120000).toISOString();
  const maxDate = new Date(expense.timestamp + 120000).toISOString();
  
  try {
    if (expense.type === 'fuel') {
      const { data: existing } = await supabase
        .from('fuel_expenses')
        .select('id')
        .eq('company_id', expense.data.company_id)
        .eq('total_amount', amountValue)
        .gte('created_at', minDate)
        .lte('created_at', maxDate)
        .maybeSingle();
      
      return !!existing;
    } else {
      const { data: existing } = await supabase
        .from('expenses')
        .select('id')
        .eq('company_id', expense.data.company_id)
        .eq('amount', amountValue)
        .gte('created_at', minDate)
        .lte('created_at', maxDate)
        .maybeSingle();
      
      return !!existing;
    }
  } catch (error) {
    console.error('Erro ao verificar duplicado:', error);
    return false; // Em caso de erro, tenta inserir
  }
}

// Remover lançamento sincronizado
async function removePendingExpense(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  await store.delete(id);
}

// Re-adicionar item ao IndexedDB em caso de falha
async function reAddPendingExpense(expense: PendingExpense): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  await store.put(expense); // put ao invés de add para evitar erro de chave duplicada
}

// Sincronizar lançamentos com o servidor
export async function syncPendingExpenses(): Promise<{ success: number; failed: number }> {
  // Prevenir execuções paralelas
  if (isSyncing) {
    console.log('⏳ Sincronização já em andamento, ignorando...');
    return { success: 0, failed: 0 };
  }
  
  isSyncing = true;
  
  try {
    const pending = await getPendingExpenses();
    let success = 0;
    let failed = 0;
    
    console.log(`📤 Iniciando sincronização de ${pending.length} lançamento(s)...`);
    
    for (const expense of pending) {
      try {
        // 1. Verificar se é duplicado
        const isDuplicate = await checkDuplicate(expense);
        if (isDuplicate) {
          console.log(`⚠️ Registro duplicado detectado, removendo do cache: ${expense.id}`);
          await removePendingExpense(expense.id);
          success++; // Conta como sucesso pois o registro já existe
          continue;
        }
        
        // 2. Remover do IndexedDB ANTES de inserir (padrão otimista)
        await removePendingExpense(expense.id);
        
        let receiptUrl = expense.data.receipt_url;
        
        // Se tem foto em Base64, fazer upload primeiro
        if (expense.photoBase64 && !receiptUrl) {
          try {
            // Converter Base64 para Blob
            const response = await fetch(expense.photoBase64);
            const blob = await response.blob();
            const file = new File([blob], `${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            // Upload para Storage
            const fileName = `${expense.data.company_id}/${expense.data.user_id}/${Date.now()}_${file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('expense-receipts')
              .upload(fileName, file);
            
            if (!uploadError && uploadData) {
              // Use signed URL for private bucket access
              const { data: signedData } = await supabase.storage
                .from('expense-receipts')
                .createSignedUrl(fileName, 31536000); // 1 year expiration
              receiptUrl = signedData?.signedUrl || null;
            }
          } catch (uploadError) {
            console.error('Erro ao fazer upload da foto:', uploadError);
          }
        }
        
        const table = expense.type === 'fuel' ? 'fuel_expenses' : 'expenses';
        const dataToInsert = { ...expense.data, receipt_url: receiptUrl };
        const { error } = await supabase.from(table).insert(dataToInsert);
        
        if (!error) {
          console.log(`✅ Sincronizado com sucesso: ${expense.type} - ${expense.id}`);
          success++;
        } else {
          console.error(`❌ Erro ao sincronizar ${expense.type}:`, error);
          // Re-adiciona ao IndexedDB para tentar novamente depois
          await reAddPendingExpense(expense);
          failed++;
        }
      } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        // Re-adiciona ao IndexedDB para tentar novamente depois
        await reAddPendingExpense(expense);
        failed++;
      }
    }
    
    console.log(`📊 Sincronização concluída: ${success} sucesso(s), ${failed} falha(s)`);
    return { success, failed };
  } finally {
    isSyncing = false;
  }
}

// Atualizar cache de jornada ativa ao reconectar
async function refreshActiveJourneyCache(): Promise<void> {
  const driverId = localStorage.getItem('current_driver_id');
  if (!driverId) return;
  
  try {
    const { data } = await supabase
      .from('journeys')
      .select('id, journey_number, origin, destination')
      .eq('driver_id', driverId)
      .eq('status', 'in_progress')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      localStorage.setItem(`active_journey_${driverId}`, JSON.stringify(data));
      console.log('🗺️ Cache de jornada atualizado:', data.journey_number);
    } else {
      localStorage.removeItem(`active_journey_${driverId}`);
      console.log('🗺️ Nenhuma jornada ativa encontrada');
    }
  } catch (error) {
    console.error('Erro ao atualizar cache de jornada:', error);
  }
}

// Verificar se está online e sincronizar automaticamente
export function setupAutoSync() {
  // Remover listeners anteriores para evitar duplicação
  const handleOnline = async () => {
    console.log('🌐 Conectado! Iniciando sincronização automática...');
    
    // Primeiro atualiza o cache de jornada
    await refreshActiveJourneyCache();
    
    // Depois sincroniza os pendentes
    const result = await syncPendingExpenses();
    
    if (result.success > 0 || result.failed > 0) {
      // Dispara evento customizado para o UI reagir
      window.dispatchEvent(new CustomEvent('offline-sync-complete', { 
        detail: result 
      }));
    }
  };
  
  window.addEventListener('online', handleOnline);
  
  // Retorna função de cleanup
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

// Verificar quantos lançamentos estão pendentes
export async function getPendingCount(): Promise<number> {
  const pending = await getPendingExpenses();
  return pending.length;
}

// Verificar se está sincronizando
export function isSyncInProgress(): boolean {
  return isSyncing;
}
