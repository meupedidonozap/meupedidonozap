import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { House,LayoutDashboard,FileText,CalendarDays,ClipboardCheck,Users,Sparkles,Package,ShoppingCart,ArrowUpRight,ArrowDownLeft,Wallet,Settings,Menu,LogOut,ArrowLeft,RefreshCw,Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet,SheetContent,SheetHeader,SheetTitle } from '@/components/ui/sheet';
import StoreAdminLogin from '@/components/StoreAdminLogin';
import CleaningDashboard from '@/components/cleaning/CleaningDashboard';
import CleaningQuoteList from '@/components/cleaning/CleaningQuoteList';
import CleaningQuoteForm from '@/components/cleaning/CleaningQuoteForm';
import CleaningAgenda from '@/components/cleaning/CleaningAgenda';
import CleaningCatalogAdmin from '@/components/cleaning/CleaningCatalogAdmin';
import CleaningCustomers,{useCleaningCustomers} from '@/components/cleaning/CleaningCustomers';
import CleaningInventoryPanel from '@/components/cleaning/CleaningInventoryPanel';
import CleaningFinance from '@/components/cleaning/CleaningFinance';
import CleaningSettings from '@/components/cleaning/CleaningSettings';
import { Choice } from '@/components/cleaning/CleaningFields';
import { useStoreBySlug } from '@/hooks/useStores';
import { useStoreAdmin } from '@/hooks/useStoreAdmin';
import { useAuth } from '@/hooks/useAuth';
import { useCleaningData,useCleaningActions } from '@/hooks/useCleaning';
import { CLEANING_SLUG } from '@/lib/cleaning';
import { toast } from 'sonner';
const menu=[['Dashboard',LayoutDashboard],['Orçamento',FileText],['Agenda',CalendarDays],['Atendimentos',ClipboardCheck],['Clientes',Users],['Serviços',Sparkles],['Produtos/Estoque',Package],['Compras',ShoppingCart],['Contas a Pagar',ArrowUpRight],['Contas a Receber',ArrowDownLeft],['Fluxo de Caixa',Wallet],['Configurações',Settings]] as const;
export default function CleaningAdminPage() {
  const {data:store,isLoading}=useStoreBySlug(CLEANING_SLUG);const {isAdmin,user,loading:accessLoading}=useStoreAdmin(store?.id);const {signOut}=useAuth();const {data,error,isFetching}=useCleaningData(store?.id||'',isAdmin?user?.id:undefined,true);const {data:customers=[]}=useCleaningCustomers(store?.id||'',!!store&&isAdmin);const actions=useCleaningActions(store?.id||'');const [tab,setTab]=useState('Dashboard');const [mobile,setMobile]=useState(false);const [create,setCreate]=useState(false);const [profile,setProfile]=useState('');
  if(isLoading||accessLoading)return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin"/></div>;
  if(!store)return <p className="p-10">Loja não encontrada.</p>;
  if(!user)return <StoreAdminLogin storeName={store.name}/>;
  if(!isAdmin)return <div className="flex min-h-screen flex-col items-center justify-center gap-4"><h1 className="text-xl">Acesso restrito à administração desta loja</h1><Button asChild><Link to={`/${store.slug}`}>Voltar à loja</Link></Button><Button variant="outline" onClick={()=>signOut()}>Sair</Button></div>;
  function navigate(next:string){setTab(next);setMobile(false);setCreate(false);}
  const nav=<><div className="flex items-center gap-3 border-b px-5 py-6"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><House/></span><span className="font-bold leading-snug">Limpa Telhas<br/><span className="text-sm font-normal text-muted-foreground">Brusque</span></span></div><nav className="flex-1 space-y-1 p-3" aria-label="Menu administrativo">{menu.map(([label,Icon],i)=><div key={label}>{[4,7,11].includes(i)&&<div className="mx-2 my-3 border-t"/>}<Button variant="ghost" className={`h-10 w-full justify-start ${tab===label?'bg-secondary font-semibold text-primary':''}`} onClick={()=>navigate(label)}><Icon className="h-4 w-4"/>{label}</Button></div>)}</nav><div className="space-y-1 border-t p-3"><Button variant="ghost" className="w-full justify-start" asChild><Link to={`/${store.slug}`}><ArrowLeft/>Página do cliente</Link></Button><Button variant="ghost" className="w-full justify-start" onClick={()=>signOut()}><LogOut/>Sair</Button></div></>;
  const quotes=data?.quotes||[],appointments=data?.appointments||[],ledger=data?.ledger||[],inventory=data?.inventory||[],purchases=data?.purchases||[];
  return <div className="cleaning-store min-h-screen bg-background text-foreground"><Helmet><title>{tab} — Limpa Telhas Brusque</title></Helmet><aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col overflow-y-auto border-r bg-card lg:flex">{nav}</aside><Sheet open={mobile} onOpenChange={setMobile}><SheetContent side="left" className="cleaning-store flex w-72 flex-col overflow-y-auto bg-card p-0"><SheetHeader className="sr-only"><SheetTitle>Menu Limpa Telhas Brusque</SheetTitle></SheetHeader>{nav}</SheetContent></Sheet><div className="lg:ml-60"><header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b bg-card px-4 sm:px-8"><div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={()=>setMobile(true)}><Menu/></Button><h1 className="text-lg font-semibold">{tab}</h1></div><div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:block">Limpa Telhas Brusque</span><Button variant="ghost" size="icon" title="Atualizar dados" disabled={isFetching} onClick={()=>actions.refresh()}><RefreshCw className={isFetching?'animate-spin':''}/></Button></div></header><main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{error?<div role="alert" className="border-l-2 border-destructive p-4"><p>Não foi possível carregar os dados.</p><Button variant="outline" onClick={()=>actions.refresh()}>Tentar novamente</Button></div>:<>
  {tab==='Dashboard'&&<CleaningDashboard quotes={quotes} appointments={appointments} ledger={ledger} onNavigate={navigate}/>}
  {tab==='Orçamento'&&<>{!create?<><div className="mb-5 flex justify-end"><Button onClick={()=>setCreate(true)}><FileText/>Novo orçamento</Button></div><CleaningQuoteList storeId={store.id} quotes={quotes} admin whatsapp={store.whatsapp}/></>:<><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><Choice label="Cliente" value={profile} onChange={setProfile} options={customers.map(c=>[c.id,c.name])}/><Button variant="ghost" onClick={()=>setCreate(false)}><ArrowLeft/>Voltar</Button></div>{!customers.length?<div className="border-y py-10"><Button onClick={()=>navigate('Clientes')}><Users/>Cadastrar cliente</Button></div>:<CleaningQuoteForm storeId={store.id} profileId={profile} onAuth={()=>toast.error('Selecione o cliente.')} onSaved={()=>setCreate(false)}/>}</>}</>}
  {(tab==='Agenda'||tab==='Atendimentos')&&<CleaningAgenda storeId={store.id} appointments={appointments} quotes={quotes} attendance={tab==='Atendimentos'}/>}
  {tab==='Clientes'&&<CleaningCustomers storeId={store.id}/>}
  {tab==='Serviços'&&<CleaningCatalogAdmin storeId={store.id}/>}
  {(tab==='Produtos/Estoque'||tab==='Compras')&&<CleaningInventoryPanel storeId={store.id} inventory={inventory} purchases={purchases} view={tab==='Compras'?'purchases':'inventory'}/>}
  {['Contas a Pagar','Contas a Receber','Fluxo de Caixa'].includes(tab)&&<CleaningFinance key={tab} storeId={store.id} ledger={ledger} view={tab==='Contas a Pagar'?'payable':tab==='Contas a Receber'?'receivable':'cash'}/>}
  {tab==='Configurações'&&<CleaningSettings store={store}/>}
  </>}</main></div></div>;
}