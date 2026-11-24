import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { CleaningQuoteInput } from '@/lib/cleaning';

export type CleaningQuote = Database['public']['Tables']['cleaning_quotes']['Row'];
export type CleaningAppointment = Database['public']['Tables']['cleaning_appointments']['Row'];
export type CleaningLedger = Database['public']['Tables']['cleaning_ledger']['Row'];
export type CleaningInventory = Database['public']['Tables']['cleaning_inventory']['Row'];
export type CleaningPurchase = Database['public']['Tables']['cleaning_purchases']['Row'];
export type CleaningCatalog = Database['public']['Tables']['cleaning_catalog']['Row'] & { products: { name: string; base_price: number; image_url: string | null; is_active: boolean; code: string } | null };
export function useCleaningCatalog(storeId: string) {
  return useQuery({ queryKey:['cleaning','catalog',storeId], queryFn:async () => {
    const {data,error}=await supabase.from('cleaning_catalog').select('*, products(name,base_price,image_url,is_active,code)').eq('store_id',storeId);
    if(error) throw error;
    return (data || []).filter(c=>c.products?.is_active).sort((a,b)=>(a.products?.name||'').localeCompare(b.products?.name||'','pt-BR')) as CleaningCatalog[];
  },staleTime:0 });
}
export function useCleaningData(storeId:string,userId:string|undefined,admin=false) {
  return useQuery({queryKey:['cleaning','data',storeId,userId,admin],enabled:!!userId,queryFn:async()=>{
    const [quotes,appointments,ledger,inventory,purchases]=await Promise.all([
      supabase.from('cleaning_quotes').select('*').eq('store_id',storeId).order('created_at',{ascending:false}),
      supabase.from('cleaning_appointments').select('*').eq('store_id',storeId).order('starts_at',{ascending:true}),
      admin ? supabase.from('cleaning_ledger').select('*').eq('store_id',storeId).order('due_date') : Promise.resolve({data:[],error:null}),
      admin ? supabase.from('cleaning_inventory').select('*').eq('store_id',storeId).order('name') : Promise.resolve({data:[],error:null}),
      admin ? supabase.from('cleaning_purchases').select('*').eq('store_id',storeId).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null}),
    ]);
    for(const result of [quotes,appointments,ledger,inventory,purchases]) if(result.error) throw result.error;
    return { quotes:(quotes.data||[]) as CleaningQuote[],appointments:(appointments.data||[]) as CleaningAppointment[],ledger:(ledger.data||[]) as CleaningLedger[],inventory:(inventory.data||[]) as CleaningInventory[],purchases:(purchases.data||[]) as CleaningPurchase[] };
  },staleTime:0,refetchOnWindowFocus:true});
}
export function useCleaningActions(storeId:string) {
  const qc=useQueryClient();
  const refresh=async()=>{ await Promise.all([qc.invalidateQueries({queryKey:['cleaning']}),qc.invalidateQueries({queryKey:['products',storeId]}),qc.invalidateQueries({queryKey:['service-orders',storeId]}),qc.invalidateQueries({queryKey:['stores', 'limpa-telhas-brusque']})]); };
  const run=async<T>(operation:()=>PromiseLike<{data:T;error: {message:string}|null}>)=> {
    const {data:{user},error:authError}=await supabase.auth.getUser(); if(authError||!user) throw new Error('Faça login novamente.');
    const {data,error}=await operation(); if(error) throw new Error(error.message.includes('cleaning_no_overlap')?'Horário indisponível. Escolha outro intervalo.':error.message); await refresh(); return data;
  };
  return {refresh,run,
    createQuote:(profileId:string,key:string,input:CleaningQuoteInput)=>run(()=>supabase.rpc('cleaning_create_quote',{p_store:storeId,p_profile:profileId,p_key:key,p_input:input as unknown as Json})),
    accept:(q:CleaningQuote)=>run(()=>supabase.rpc('cleaning_accept_quote',{p_id:q.id,p_expected_total:q.total ?? 0})),
    review:(id:string,total:number)=>run(()=>supabase.rpc('cleaning_review_quote',{p_id:id,p_total:total})),
    schedule:(quoteId:string|null,start:string,end:string,notes='')=>run(()=>supabase.rpc('cleaning_schedule',{p_store:storeId,p_quote:quoteId as unknown as string,p_start:start,p_end:end,p_notes:notes})),
    appointment:(id:string,status:string,start?:string,end?:string)=>run(()=>supabase.rpc('cleaning_appointment_action',{p_id:id,p_status:status,...(start?{p_start:start,p_end:end}:{})})),
    receive:(id:string)=>run(()=>supabase.rpc('cleaning_receive_purchase',{p_id:id})),
  };
}