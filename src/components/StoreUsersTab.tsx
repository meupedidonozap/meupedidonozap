import { useState } from 'react';
import { Plus, Edit2, Trash2, KeyRound, Loader2, ShieldCheck, ToggleLeft, ToggleRight, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import {
  useStoreUsers,
  useCreateStoreUser,
  useUpdateStoreUser,
  useDeleteStoreUser,
  useResetStoreUserPassword,
  type StoreUser,
} from '@/hooks/useStoreUsers';
import type { StorePermissions } from '@/hooks/useStoreAdmin';
import type { StoreType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllStoreSellers } from '@/hooks/useStoreSellers';

interface PermissionItem {
  key: keyof StorePermissions;
  label: string;
  description: string;
  showFor?: StoreType[];
}

const PERMISSIONS: PermissionItem[] = [
  {
    key: 'can_view_service_orders',
    label: 'Ver Ordens de Serviço',
    description: 'Visualizar e imprimir OS (sem alterar status)',
    showFor: ['SERVICOS'],
  },
  {
    key: 'can_manage_service_orders',
    label: 'Gerenciar Ordens de Serviço',
    description: 'Criar, editar e mudar status das OS',
    showFor: ['SERVICOS'],
  },
  { key: 'can_view_orders', label: 'Ver Pedidos', description: 'Visualizar e imprimir pedidos' },
  { key: 'can_manage_orders', label: 'Gerenciar Pedidos', description: 'Mudar status, editar pedidos' },
  { key: 'can_manage_products', label: 'Gerenciar Produtos', description: 'Criar/editar produtos e categorias' },
  { key: 'can_view_customers', label: 'Ver Clientes', description: 'Acessar a aba de clientes' },
  { key: 'can_manage_tables', label: 'Garçom (Mesas)', description: 'Abrir mesas, lançar pedidos via cardápio e cobrar' },
];

const emptyPerms: StorePermissions = {
  can_view_service_orders: false,
  can_manage_service_orders: false,
  can_view_orders: false,
  can_manage_orders: false,
  can_manage_products: false,
  can_view_customers: false,
  can_manage_tables: false,
};

const GARCOM_PERMS: StorePermissions = {
  ...emptyPerms,
  can_manage_tables: true,
};

const isGarcomPreset = (p: { [k in keyof StorePermissions]?: boolean }) =>
  !!p.can_manage_tables &&
  !p.can_manage_products && !p.can_view_customers &&
  !p.can_view_service_orders && !p.can_manage_service_orders;

interface Props {
  storeId: string;
  storeType: StoreType;
}

export default function StoreUsersTab({ storeId, storeType }: Props) {
  const { data: users = [], isLoading } = useStoreUsers(storeId);
  const { data: allSellers = [] } = useAllStoreSellers(storeId);
  const createMut = useCreateStoreUser();
  const updateMut = useUpdateStoreUser();
  const deleteMut = useDeleteStoreUser();
  const resetPwMut = useResetStoreUserPassword();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StoreUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [perms, setPerms] = useState<StorePermissions>(emptyPerms);
  const [sellerCodes, setSellerCodes] = useState<string[]>([]);
  const [sellerFilter, setSellerFilter] = useState('');
  const [role, setRole] = useState<'auxiliar' | 'vendedor' | 'televendas'>('auxiliar');

  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwTargetUser, setPwTargetUser] = useState<StoreUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const visiblePerms = PERMISSIONS.filter(p => !p.showFor || p.showFor.includes(storeType));

  const openNew = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPassword('');
    setPerms(emptyPerms);
    setSellerCodes([]);
    setSellerFilter('');
    setRole('auxiliar');
    setDialogOpen(true);
  };

  const openEdit = (u: StoreUser) => {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setPerms({
      can_view_service_orders: u.can_view_service_orders,
      can_manage_service_orders: u.can_manage_service_orders,
      can_view_orders: u.can_view_orders,
      can_manage_orders: u.can_manage_orders,
      can_manage_products: u.can_manage_products,
      can_view_customers: u.can_view_customers,
      can_manage_tables: u.can_manage_tables,
    });
    setSellerCodes(Array.isArray(u.seller_codes) ? [...u.seller_codes] : []);
    setSellerFilter('');
    setRole((u.role as any) || 'auxiliar');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome');
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({
          storeId,
          storeUserId: editing.id,
          name,
          permissions: perms,
          sellerCodes: role === 'auxiliar' ? [] : sellerCodes,
          role,
        });
        toast.success('Usuário atualizado!');
      } else {
        if (!email.trim() || password.length < 6) {
          toast.error('Email e senha (mín. 6 caracteres) obrigatórios');
          return;
        }
        await createMut.mutateAsync({
          storeId,
          email: email.trim(),
          password,
          name: name.trim(),
          permissions: perms,
          sellerCodes: role === 'auxiliar' ? [] : sellerCodes,
          role,
        });
        toast.success('Usuário criado!');
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    }
  };

  const handleToggleActive = async (u: StoreUser) => {
    try {
      await updateMut.mutateAsync({
        storeId,
        storeUserId: u.id,
        isActive: !u.is_active,
      });
      toast.success(u.is_active ? 'Usuário desativado' : 'Usuário ativado');
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    }
  };

  const handleDelete = async (u: StoreUser) => {
    if (!confirm(`Excluir o acesso de "${u.name}"?\n(O login no sistema será mantido, apenas o vínculo com a loja será removido)`)) return;
    try {
      await deleteMut.mutateAsync({ storeId, storeUserId: u.id });
      toast.success('Acesso removido!');
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    }
  };

  const openResetPw = (u: StoreUser) => {
    setPwTargetUser(u);
    setNewPassword('');
    setPwDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!pwTargetUser || newPassword.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    try {
      await resetPwMut.mutateAsync({
        storeId,
        storeUserId: pwTargetUser.id,
        password: newPassword,
      });
      toast.success(`Senha de ${pwTargetUser.name} alterada!`);
      setPwDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    }
  };

  const summarizePerms = (u: StoreUser) => {
    if (isGarcomPreset(u as any)) {
      return <Badge className="bg-orange-100 text-orange-700">🍽 Garçom</Badge>;
    }
    const items = visiblePerms.filter(p => u[p.key]).map(p => p.label);
    if (items.length === 0) return <span className="text-muted-foreground italic">Sem permissões</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {items.map(label => (
          <Badge key={label} variant="secondary" className="text-xs">{label}</Badge>
        ))}
      </div>
    );
  };

  const summarizeSellers = (u: StoreUser) => {
    const codes = Array.isArray(u.seller_codes) ? u.seller_codes : [];
    const r = (u.role || 'auxiliar') as string;
    if (r === 'auxiliar' || codes.length === 0) {
      return <span className="text-muted-foreground italic text-xs">Todos (Auxiliar)</span>;
    }
    const byCode = new Map(allSellers.map(s => [(s.code || '').trim(), s.name]));
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {r === 'televendas' ? 'Televendas' : 'Vendedor'}
        </span>
        <div className="flex flex-wrap gap-1">
          {codes.map(c => (
            <Badge key={c} variant="outline" className="text-xs">
              {c}{byCode.get(c) ? ` · ${byCode.get(c)}` : ''}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  const filteredSellers = allSellers.filter(s => {
    if (!sellerFilter.trim()) return true;
    const q = sellerFilter.toLowerCase();
    return (s.code || '').toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" /> Usuários da Loja
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Crie acessos restritos para funcionários (ex: ver e imprimir OS sem alterar nada)
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Usuário
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">Nenhum usuário secundário cadastrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / Email</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Vendedores</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>{summarizePerms(u)}</TableCell>
                    <TableCell>{summarizeSellers(u)}</TableCell>
                    <TableCell>
                      <button onClick={() => handleToggleActive(u)} className="text-muted-foreground hover:text-foreground">
                        {u.is_active
                          ? <ToggleRight className="h-6 w-6 text-accent" />
                          : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)} title="Editar permissões">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openResetPw(u)} title="Redefinir senha">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} title="Remover acesso" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Usuário' : 'Novo Usuário da Loja'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="su-name">Nome</Label>
              <Input id="su-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Funcionário Recepção" />
            </div>
            {!editing && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="funcionario@loja.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="su-pw">Senha (mín. 6 caracteres)</Label>
                  <Input id="su-pw" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Ex: funcionario123" />
                </div>
              </>
            )}

            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">Permissões</div>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => setPerms(GARCOM_PERMS)}
                    title="Aplicar permissões de Garçom (ver e gerenciar pedidos)">
                    🍽 Garçom
                  </Button>
                </div>
              </div>
              {isGarcomPreset(perms) && (
                <div className="rounded bg-orange-50 px-2 py-1 text-xs text-orange-700">
                  Perfil Garçom selecionado — usuário poderá acessar <strong>/{ '' }
                  {`{slug}/garcom`}</strong> para abrir mesas e lançar pedidos.
                </div>
              )}
              {visiblePerms.map(p => (
                <label key={p.key} className="flex items-start gap-2 cursor-pointer hover:bg-muted/40 p-2 rounded">
                  <Checkbox
                    checked={perms[p.key]}
                    onCheckedChange={(v) => setPerms(prev => ({ ...prev, [p.key]: !!v }))}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div className="grid gap-2">
                <Label className="text-sm font-semibold">Tipo de Usuário</Label>
                <Select value={role} onValueChange={(v) => {
                  const r = v as 'auxiliar' | 'vendedor' | 'televendas';
                  setRole(r);
                  if (r === 'auxiliar') setSellerCodes([]);
                  if (r === 'vendedor' && sellerCodes.length > 1) setSellerCodes([sellerCodes[0]]);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auxiliar">Auxiliar — vê todos os clientes</SelectItem>
                    <SelectItem value="vendedor">Vendedor — vê apenas os seus clientes</SelectItem>
                    <SelectItem value="televendas">Televendas — vê os clientes de vários vendedores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {role !== 'auxiliar' && (
                <>
              <div className="font-semibold text-sm pt-1">
                {role === 'vendedor' ? 'Vendedor vinculado' : 'Vendedores vinculados'}
              </div>
              <p className="text-xs text-muted-foreground">
                {role === 'vendedor'
                  ? 'Selecione o vendedor cujos clientes este usuário poderá ver e editar.'
                  : 'Selecione um ou mais vendedores. O usuário verá os clientes de todos eles.'}
              </p>
              {sellerCodes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {sellerCodes.map(c => (
                    <Badge key={c} variant="secondary" className="text-xs gap-1">
                      {c}
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setSellerCodes(prev => prev.filter(x => x !== c))}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Input
                placeholder="Filtrar por código ou nome…"
                value={sellerFilter}
                onChange={e => setSellerFilter(e.target.value)}
                className="h-8"
              />
              <div className="max-h-44 overflow-y-auto border rounded p-2 space-y-1">
                {filteredSellers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum vendedor encontrado.</p>
                ) : filteredSellers.map(s => {
                  const code = (s.code || '').trim();
                  const hasCode = !!code;
                  const checked = hasCode && sellerCodes.includes(code);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${hasCode ? 'cursor-pointer hover:bg-muted/40' : 'opacity-50 cursor-not-allowed'}`}
                      title={hasCode ? '' : 'Cadastre um código para este representante na aba Vendedores'}
                    >
                      <Checkbox
                        disabled={!hasCode}
                        checked={checked}
                        onCheckedChange={(v) => {
                          if (!hasCode) return;
                          if (role === 'vendedor') {
                            setSellerCodes(v ? [code] : []);
                          } else {
                            setSellerCodes(prev => v ? Array.from(new Set([...prev, code])) : prev.filter(x => x !== code));
                          }
                        }}
                      />
                      <span className="font-mono text-xs w-12">{hasCode ? code : '—'}</span>
                      <span className="flex-1 truncate">{s.name}</span>
                      {!hasCode && <span className="text-[10px] text-muted-foreground italic">sem código</span>}
                    </label>
                  );
                })}
              </div>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar Permissões' : 'Criar Usuário'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir senha — {pwTargetUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="new-pw">Nova senha</Label>
            <Input id="new-pw" type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPwDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resetPwMut.isPending}>
              {resetPwMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Nova Senha
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}