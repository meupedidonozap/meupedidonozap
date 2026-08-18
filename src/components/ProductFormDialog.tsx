import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Upload, Image as ImageIcon, GripVertical, Clock } from 'lucide-react';
import type { Product, ProductVariant, Category, StoreType, AssemblyMode } from '@/types';
import { useCreateProduct, useUpdateProduct, useProducts } from '@/hooks/useProducts';
import { useKitItems, useSaveKitItems } from '@/hooks/useProductKits';
import { useSalonProfessionals } from '@/hooks/useSalon';
import { useIngredients } from '@/hooks/useIngredients';
import { useProductAssemblies, useUpsertProductAssembly } from '@/hooks/useProductAssembly';
import { Checkbox } from '@/components/ui/checkbox';
import { uploadProductImage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  categories: Category[];
  product?: Product | null;
  storeType?: StoreType;
  /** Loja trabalha com integração Bling (mostra o campo Código BLING). */
  useBlingIntegration?: boolean;
}

interface VariantForm {
  color: string;
  size: string;
  price: number;
  stock: number;
  sku: string;
  priceTable1: number;
  priceTable4: number;
  priceTable9: number;
  priceTable11: number;
}

interface ImageForm {
  file?: File;
  url?: string; // existing URL from DB
  label: string;
}

async function touchStoreDataVersion(storeId: string) {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('settings')
      .eq('id', storeId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn('[ProductForm] dataVersion read failed', error);
      return;
    }

    const settings = (data.settings as Record<string, unknown> | null) || {};
    const { error: updateError } = await supabase
      .from('stores')
      .update({ settings: { ...settings, dataVersion: new Date().toISOString() } })
      .eq('id', storeId);

    if (updateError) console.warn('[ProductForm] dataVersion update failed', updateError);
  } catch (err) {
    console.warn('[ProductForm] dataVersion touch failed', err);
  }
}

export default function ProductFormDialog({
  open,
  onOpenChange,
  storeId,
  categories,
  product,
  storeType,
  useBlingIntegration,
}: ProductFormDialogProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const isSalon = storeType === 'SALAO';
  const isFood = storeType === 'COMIDA';
  const { data: professionals = [] } = useSalonProfessionals(isSalon ? storeId : undefined);
  const { data: ingredients = [] } = useIngredients(isFood ? storeId : undefined);
  const { data: assemblies = [] } = useProductAssemblies(isFood ? storeId : undefined);
  const upsertAssembly = useUpsertProductAssembly();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [priceTable1, setPriceTable1] = useState('');
  const [priceTable9, setPriceTable9] = useState('');
  const [priceTable11, setPriceTable11] = useState('');
  const [stock, setStock] = useState('0');
  const [unit, setUnit] = useState('Un');
  const [blingCode, setBlingCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [hasVariants, setHasVariants] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [variants, setVariants] = useState<VariantForm[]>([]);
  const [productImages, setProductImages] = useState<ImageForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);

  // KIT state
  const [isKit, setIsKit] = useState(false);
  const [kitItems, setKitItems] = useState<{ componentProductId: string; quantity: number }[]>([]);
  const [kitSearch, setKitSearch] = useState('');
  const { data: allProducts = [] } = useProducts(open ? storeId : undefined);
  const { data: existingKitItems } = useKitItems(open && product?.id ? product.id : undefined);
  const saveKit = useSaveKitItems();

  // Food assembly state
  const [assemblyMode, setAssemblyMode] = useState<AssemblyMode>('fixed');
  const [allowObservation, setAllowObservation] = useState(false);
  const [allowBorder, setAllowBorder] = useState(false);
  const [defaultIngredientIds, setDefaultIngredientIds] = useState<string[]>([]);
  const [limitsByVariant, setLimitsByVariant] = useState<Record<string, number>>({});

  useEffect(() => {
    if (product) {
      setCode(product.code);
      setName(product.name);
      setDescription(product.description);
      setCategoryId(product.categoryId || '');
      setBasePrice(String(product.basePrice));
      setPriceTable1(product.priceTable1 != null && product.priceTable1 > 0 ? String(product.priceTable1) : '');
      setPriceTable9(product.priceTable9 != null && product.priceTable9 > 0 ? String(product.priceTable9) : '');
      setPriceTable11(product.priceTable11 != null && product.priceTable11 > 0 ? String(product.priceTable11) : '');
      setStock(String(product.stock ?? 0));
      setUnit((product as any).unit || 'Un');
      setBlingCode((product as any).blingCode || '');
      setIsActive(product.isActive);
      setHasVariants(product.hasVariants);
      setImagePreview(product.image || null);
      setImageFile(null);
      setDurationMinutes(String(product.durationMinutes ?? 30));
      setProfessionalIds(product.professionalIds || []);
      setIsKit(!!product.isKit);
      setKitSearch('');
      setVariants(
        product.variants?.map(v => ({
          color: v.color || '',
          size: v.size || '',
          price: v.price,
          stock: v.stock,
          sku: v.sku,
          priceTable1: v.priceTable1 != null && v.priceTable1 > 0 ? v.priceTable1 : v.price,
          priceTable4: v.priceTable4 != null && v.priceTable4 > 0 ? v.priceTable4 : v.price,
          priceTable9: v.priceTable9 != null && v.priceTable9 > 0 ? v.priceTable9 : v.price,
          priceTable11: (v as any).priceTable11 != null && (v as any).priceTable11 > 0 ? (v as any).priceTable11 : v.price,
        })) || []
      );
      setProductImages(
        product.images?.map(img => ({
          url: img.imageUrl,
          label: img.label || '',
        })) || []
      );
      // Load existing assembly config if any
      const a = assemblies.find(x => x.productId === product.id);
      if (a) {
        setAssemblyMode(a.mode);
        setAllowObservation(a.allowObservation);
        setAllowBorder(a.allowBorder);
        setDefaultIngredientIds(a.defaultIngredientIds);
        setLimitsByVariant(a.limitsByVariant);
      } else {
        setAssemblyMode('fixed');
        setAllowObservation(false);
        setAllowBorder(false);
        setDefaultIngredientIds([]);
        setLimitsByVariant({});
      }
    } else {
      setCode('');
      setName('');
      setDescription('');
      setCategoryId('');
      setBasePrice('');
      setPriceTable1('');
      setPriceTable9('');
      setPriceTable11('');
      setStock('0');
      setUnit('Un');
      setBlingCode('');
      setIsActive(true);
      setHasVariants(false);
      setImagePreview(null);
      setImageFile(null);
      setVariants([]);
      setProductImages([]);
      setDurationMinutes('30');
      setProfessionalIds([]);
      setIsKit(false);
      setKitItems([]);
      setKitSearch('');
      setAssemblyMode('fixed');
      setAllowObservation(false);
      setAllowBorder(false);
      setDefaultIngredientIds([]);
      setLimitsByVariant({});
    }
    // NOTE: `assemblies` intentionally omitted from deps — it defaults to a
    // fresh `[]` each render which would cause an infinite update loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, open]);

  useEffect(() => {
    if (!open || !product?.id) return;
    if (!existingKitItems) return;
    setKitItems(existingKitItems.map(k => ({ componentProductId: k.componentProductId, quantity: k.quantity })));
  }, [existingKitItems, product?.id, open]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('[ProductForm] handleImageSelect', file);
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleMultiImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: ImageForm[] = Array.from(files).map(file => ({
      file,
      label: '',
    }));
    setProductImages(prev => [...prev, ...newImages]);
    if (multiFileInputRef.current) multiFileInputRef.current.value = '';
  };

  const removeProductImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
  };

  const updateImageLabel = (index: number, label: string) => {
    setProductImages(prev =>
      prev.map((img, i) => (i === index ? { ...img, label } : img))
    );
  };

  const getImagePreviewUrl = (img: ImageForm) => {
    if (img.url) return img.url;
    if (img.file) return URL.createObjectURL(img.file);
    return null;
  };

  const addVariant = () => {
    const bp = Number(basePrice) || 0;
    const pt1 = Number(priceTable1) || bp;
    const pt9 = Number(priceTable9) || bp;
    const pt11 = Number(priceTable11) || bp;
    setVariants(prev => [...prev, {
      color: '', size: '', price: bp, stock: 0, sku: '',
      priceTable1: pt1, priceTable4: bp, priceTable9: pt9, priceTable11: pt11,
    }]);
  };

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantForm, value: string | number) => {
    setVariants(prev =>
      prev.map((v, i) => {
        if (i !== index) return v;
        const next = { ...v, [field]: value } as VariantForm;
        // Keep the legacy `price` column in sync with Tabela 4 (default retail).
        if (field === 'priceTable4') next.price = Number(value) || 0;
        if (field === 'price') next.priceTable4 = Number(value) || 0;
        return next;
      })
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome do produto é obrigatório');
      return;
    }

    setSaving(true);
    try {
      let imageUrl = product?.image || null;

      if (imageFile) {
        imageUrl = await uploadProductImage(imageFile, storeId);
      }

      // Upload multi-images for variants
      const uploadedImages: { imageUrl: string; label?: string }[] = [];
      if (hasVariants && productImages.length > 0) {
        for (const img of productImages) {
          if (img.file) {
            const url = await uploadProductImage(img.file, storeId);
            uploadedImages.push({ imageUrl: url, label: img.label || undefined });
          } else if (img.url) {
            uploadedImages.push({ imageUrl: img.url, label: img.label || undefined });
          }
        }
        // Use first image as main image if no single image was uploaded
        if (!imageFile && uploadedImages.length > 0) {
          imageUrl = uploadedImages[0].imageUrl;
        }
      }

      const variantData = hasVariants
        ? variants.map(v => ({
            color: v.color || undefined,
            size: v.size || undefined,
            price: v.priceTable4 || v.price,
            stock: v.stock,
            sku: v.sku,
            priceTable1: v.priceTable1 || v.priceTable4 || v.price,
            priceTable4: v.priceTable4 || v.price,
            priceTable9: v.priceTable9 || v.priceTable4 || v.price,
            priceTable11: (v as any).priceTable11 || v.priceTable4 || v.price,
          }))
        : [];

      if (product) {
        await updateProduct.mutateAsync({
          id: product.id,
          code,
          name,
          description,
          categoryId: categoryId || null,
          basePrice: Number(basePrice) || 0,
          priceTable1: Number(priceTable1) || Number(basePrice) || 0,
          priceTable4: Number(basePrice) || 0,
          priceTable9: Number(priceTable9) || Number(basePrice) || 0,
          priceTable11: Number(priceTable11) || Number(basePrice) || 0,
          imageUrl: imageUrl,
          isActive,
          stock: Math.trunc(Number(stock) || 0),
          unit: unit.trim() || 'Un',
          hasVariants,
          variants: variantData,
          images: hasVariants ? uploadedImages : [],
          durationMinutes: isSalon ? Number(durationMinutes) || 30 : undefined,
          professionalIds: isSalon ? professionalIds : undefined,
        });
        if (isFood) {
          await upsertAssembly.mutateAsync({
            productId: product.id,
            blingCode: blingCode.trim(),
            mode: assemblyMode,
            allowObservation,
            allowBorder,
            defaultIngredientIds,
            limitsByVariant,
          });
        }
        await saveKit.mutateAsync({
          kitProductId: product.id,
          isKit,
          items: kitItems.filter(k => k.componentProductId && k.quantity > 0),
        });
        toast.success('Produto atualizado!');
      } else {
        const created = await createProduct.mutateAsync({
          storeId,
          code,
          name,
          description,
          categoryId: categoryId || null,
          basePrice: Number(basePrice) || 0,
          priceTable1: Number(priceTable1) || Number(basePrice) || 0,
          priceTable4: Number(basePrice) || 0,
          priceTable9: Number(priceTable9) || Number(basePrice) || 0,
          priceTable11: Number(priceTable11) || Number(basePrice) || 0,
          imageUrl: imageUrl || undefined,
          isActive,
          stock: Math.trunc(Number(stock) || 0),
          unit: unit.trim() || 'Un',
          hasVariants,
          variants: variantData,
          images: hasVariants ? uploadedImages : [],
          durationMinutes: isSalon ? Number(durationMinutes) || 30 : undefined,
          professionalIds: isSalon ? professionalIds : undefined,
        });
        if (isFood && created?.id) {
          await upsertAssembly.mutateAsync({
            productId: created.id,
            mode: assemblyMode,
            allowObservation,
            allowBorder,
            defaultIngredientIds,
            limitsByVariant,
          });
        }
        if (created?.id && isKit) {
          await saveKit.mutateAsync({
            kitProductId: created.id,
            isKit,
            items: kitItems.filter(k => k.componentProductId && k.quantity > 0),
          });
        }
        toast.success('Produto criado!');
      }

      await touchStoreDataVersion(storeId);

      onOpenChange(false);
    } catch (err: any) {
      console.error('[ProductForm] save error', err);
      const msg = err?.message || err?.error_description || err?.error || JSON.stringify(err);
      toast.error(`Erro ao salvar: ${msg}`, { duration: 12000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? (isSalon ? 'Editar Serviço' : 'Editar Produto') : (isSalon ? 'Novo Serviço' : 'Novo Produto')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Single Image Upload (shown when no variants) */}
          {!hasVariants && (
            <div className="grid gap-2">
              <Label>Imagem do Produto</Label>
              <div className="flex items-center gap-4">
                <div
                  className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 overflow-hidden hover:border-primary/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {imagePreview ? 'Trocar' : 'Upload'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Código</Label>
              <Input id="code" value={code} onChange={e => setCode(e.target.value)} placeholder="SKU-001" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pname">Nome *</Label>
              <Input id="pname" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do Produto" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição do produto" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{isSalon ? 'Tipo de serviço' : 'Categoria'}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">{isSalon ? 'Preço (R$)' : 'Preço (Tabela 4 — Varejo)'}</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {!isSalon && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 bg-muted/20">
              <div className="grid gap-2">
                <Label htmlFor="price-t1" className="text-xs">Tabela 1 (Atacado)</Label>
                <Input
                  id="price-t1"
                  type="number"
                  step="0.01"
                  value={priceTable1}
                  onChange={e => setPriceTable1(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price-t9" className="text-xs">Tabela 9 (Atacado)</Label>
                <Input
                  id="price-t9"
                  type="number"
                  step="0.01"
                  value={priceTable9}
                  onChange={e => setPriceTable9(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price-t11" className="text-xs">Tabela 11</Label>
                <Input
                  id="price-t11"
                  type="number"
                  step="0.01"
                  value={priceTable11}
                  onChange={e => setPriceTable11(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                A Tabela 4 é preenchida pelo campo "Preço" acima. Campo em branco significa que ainda não há preço gravado nessa tabela — ao salvar, ele fica igual ao "Preço".
              </p>
            </div>
          )}

          {!isSalon && (
            <div className="grid gap-2">
              <Label htmlFor="unit">Unidade</Label>
              <Input id="unit" value={unit} onChange={e => setUnit(e.target.value)} placeholder="Un" />
              <p className="text-xs text-muted-foreground">
                Usada na exportação para o Bling (ex.: Un, Pç, Cx, Lt).
              </p>
            </div>
          )}

          {useBlingIntegration && (
            <div className="grid gap-2">
              <Label htmlFor="blingCode">Código BLING</Label>
              <Input
                id="blingCode"
                value={blingCode}
                onChange={e => setBlingCode(e.target.value)}
                placeholder="Ex.: KIT-SENSES-NUTRI"
              />
              <p className="text-xs text-muted-foreground">
                Usado no lugar do código do sistema ao baixar o XML no formato Bling. Em branco, usa o código do sistema.
              </p>
            </div>
          )}

          {!isSalon && !hasVariants && (
            <div className="grid gap-2">
              <Label htmlFor="stock">Estoque</Label>
              <Input
                id="stock"
                type="number"
                step="1"
                value={stock}
                onChange={e => setStock(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Com estoque 0 o produto aparece como ESGOTADO e não pode ser comprado.
              </p>
            </div>
          )}

          {isSalon && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div className="grid gap-2">
                <Label htmlFor="duration" className="flex items-center gap-2"><Clock className="h-4 w-4" /> Tempo de execução (minutos) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  step={5}
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(e.target.value)}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground">Usado para gerar os horários disponíveis na agenda.</p>
              </div>
              <div className="grid gap-2">
                <Label>Profissionais que realizam este serviço</Label>
                <div className="space-y-1 border rounded p-2 bg-background max-h-48 overflow-y-auto">
                  {professionals.length === 0 && (
                    <p className="text-sm text-muted-foreground">Cadastre profissionais na aba Salão antes de vincular.</p>
                  )}
                  {professionals.filter(p => p.isActive).map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <Checkbox
                        checked={professionalIds.includes(p.id)}
                        onCheckedChange={() => setProfessionalIds(prev =>
                          prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                        )}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Status</Label>
              <p className="text-sm text-muted-foreground">{isActive ? 'Produto ativo' : 'Produto inativo'}</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {!isSalon && (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Possui Variantes</Label>
              <p className="text-sm text-muted-foreground">Cor, tamanho, etc.</p>
            </div>
            <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
          </div>
          )}

          {!isSalon && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Produto KIT</Label>
                  <p className="text-sm text-muted-foreground">
                    Composto por outros produtos. No pedido, o kit é transmitido pelos itens que o compõem.
                  </p>
                </div>
                <Switch checked={isKit} onCheckedChange={setIsKit} />
              </div>

              {isKit && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {kitItems.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum item no kit ainda.</p>
                    )}
                    {kitItems.map((k, i) => {
                      const p = allProducts.find(x => x.id === k.componentProductId);
                      return (
                        <div key={`${k.componentProductId}-${i}`} className="flex items-center gap-2 rounded border p-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p?.name || 'Produto removido'}</p>
                            <p className="truncate text-xs text-muted-foreground">{p?.code}</p>
                          </div>
                          <Input
                            type="number"
                            min={1}
                            className="w-20"
                            value={k.quantity}
                            onChange={e =>
                              setKitItems(prev =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x
                                )
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setKitItems(prev => prev.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <Label>Adicionar item ao kit</Label>
                    <Input
                      placeholder="Buscar por código ou nome..."
                      value={kitSearch}
                      onChange={e => setKitSearch(e.target.value)}
                    />
                    {kitSearch.trim().length >= 2 && (
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
                        {allProducts
                          .filter(p => p.id !== product?.id && !p.isKit)
                          .filter(p => {
                            const q = kitSearch.trim().toLowerCase();
                            return (
                              p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 30)
                          .map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                setKitItems(prev => {
                                  const found = prev.findIndex(x => x.componentProductId === p.id);
                                  if (found >= 0) {
                                    return prev.map((x, i) => (i === found ? { ...x, quantity: x.quantity + 1 } : x));
                                  }
                                  return [...prev, { componentProductId: p.id, quantity: 1 }];
                                });
                                setKitSearch('');
                              }}
                            >
                              <Plus className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {p.code ? `${p.code} - ` : ''}
                                {p.name}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multi-Image Upload (shown when has variants) */}
          {hasVariants && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Label>Fotos do Produto</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => multiFileInputRef.current?.click()}
                  className="gap-1"
                >
                  <Upload className="h-3 w-3" /> Adicionar Fotos
                </Button>
                <input
                  ref={multiFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleMultiImageSelect}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {productImages.map((img, i) => {
                  const previewUrl = getImagePreviewUrl(img);
                  return (
                    <div key={i} className="group relative space-y-1">
                      <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                        {previewUrl ? (
                          <img src={previewUrl} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeProductImage(i)}
                          className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <Input
                        value={img.label}
                        onChange={e => updateImageLabel(i, e.target.value)}
                        placeholder="Ex: Azul"
                        className="h-7 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
              {productImages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhuma foto adicionada. Adicione fotos para cada variação de cor.</p>
              )}
            </div>
          )}

          {hasVariants && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Label>Variantes</Label>
                <Button type="button" variant="outline" size="sm" onClick={addVariant} className="gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-9 gap-2 items-end">
                  <div>
                    <Label className="text-xs">Cor</Label>
                    <Input value={v.color} onChange={e => updateVariant(i, 'color', e.target.value)} placeholder="Azul" />
                  </div>
                  <div>
                    <Label className="text-xs">Tamanho</Label>
                    <Input value={v.size} onChange={e => updateVariant(i, 'size', e.target.value)} placeholder="M" />
                  </div>
                  <div>
                    <Label className="text-xs">Tab. 1</Label>
                    <Input type="number" step="0.01" value={v.priceTable1} onChange={e => updateVariant(i, 'priceTable1', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Tab. 4</Label>
                    <Input type="number" step="0.01" value={v.priceTable4} onChange={e => updateVariant(i, 'priceTable4', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Tab. 9</Label>
                    <Input type="number" step="0.01" value={v.priceTable9} onChange={e => updateVariant(i, 'priceTable9', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Tab. 11</Label>
                    <Input type="number" step="0.01" value={(v as any).priceTable11 ?? 0} onChange={e => updateVariant(i, 'priceTable11' as any, Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Estoque</Label>
                    <Input type="number" value={v.stock} onChange={e => updateVariant(i, 'stock', Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">SKU</Label>
                    <Input value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(i)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {variants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhuma variante adicionada</p>
              )}
            </div>
          )}

          {isFood && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
              <Label className="text-base font-semibold">Montagem (Comida)</Label>

              <div className="grid gap-2">
                <Label className="text-xs">Modo de montagem</Label>
                <Select value={assemblyMode} onValueChange={(v) => setAssemblyMode(v as AssemblyMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixo (sem montagem — ex.: bebidas)</SelectItem>
                    <SelectItem value="remove">Remover (vem com tudo, cliente desmarca — ex.: lanche)</SelectItem>
                    <SelectItem value="choose">Escolher (cliente seleciona — ex.: pastel/pizza)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(assemblyMode === 'remove' || assemblyMode === 'choose') && (
                <div className="grid gap-2">
                  <Label className="text-xs">
                    {assemblyMode === 'remove' ? 'Ingredientes que já vêm (cliente pode remover)' : 'Ingredientes pré-marcados (opcional)'}
                  </Label>
                  <div className="max-h-40 overflow-y-auto rounded border p-2 bg-background space-y-1">
                    {ingredients.length === 0 && (
                      <p className="text-xs text-muted-foreground">Cadastre ingredientes na aba Ingredientes.</p>
                    )}
                    {ingredients
                      .filter(i => !categoryId || i.categoryIds.length === 0 || i.categoryIds.includes(categoryId))
                      .map(ing => (
                        <label key={ing.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={defaultIngredientIds.includes(ing.id)}
                            onCheckedChange={() => setDefaultIngredientIds(prev =>
                              prev.includes(ing.id) ? prev.filter(x => x !== ing.id) : [...prev, ing.id]
                            )}
                          />
                          <span>{ing.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {assemblyMode === 'choose' && (
                <div className="grid gap-2">
                  <Label className="text-xs">Limites de ingredientes</Label>
                  {hasVariants && variants.length > 0 ? (
                    <div className="space-y-2">
                      {variants.map((v, i) => {
                        const key = `var_${i}`; // fallback key by index (variants don't have id yet on create)
                        const realKey = (product?.variants?.[i]?.id) || 'default';
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-sm w-24">{v.size || v.color || `Variante ${i + 1}`}</span>
                            <Input
                              type="number"
                              min={1}
                              className="w-24"
                              value={limitsByVariant[realKey] ?? ''}
                              onChange={e => setLimitsByVariant(prev => ({ ...prev, [realKey]: Number(e.target.value) || 0 }))}
                              placeholder="máx."
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min={1}
                      value={limitsByVariant['default'] ?? ''}
                      onChange={e => setLimitsByVariant({ default: Number(e.target.value) || 0 })}
                      placeholder="Máx. de ingredientes"
                    />
                  )}
                </div>
              )}

              <div className="flex items-center justify-between rounded border p-2 bg-background">
                <Label className="text-sm">Permitir borda recheada (pizza)</Label>
                <Switch checked={allowBorder} onCheckedChange={setAllowBorder} />
              </div>

              <div className="flex items-center justify-between rounded border p-2 bg-background">
                <Label className="text-sm">Permitir observação do cliente</Label>
                <Switch checked={allowObservation} onCheckedChange={setAllowObservation} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : product ? 'Salvar' : 'Criar Produto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
