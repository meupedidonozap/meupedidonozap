import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Upload, Image as ImageIcon, GripVertical, Clock } from 'lucide-react';
import type { Product, ProductVariant, Category, StoreType, AssemblyMode } from '@/types';
import { useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useSalonProfessionals } from '@/hooks/useSalon';
import { useIngredients } from '@/hooks/useIngredients';
import { useProductAssemblies, useUpsertProductAssembly } from '@/hooks/useProductAssembly';
import { Checkbox } from '@/components/ui/checkbox';
import { uploadProductImage } from '@/lib/storage';
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
}

interface VariantForm {
  color: string;
  size: string;
  price: number;
  stock: number;
  sku: string;
}

interface ImageForm {
  file?: File;
  url?: string; // existing URL from DB
  label: string;
}

export default function ProductFormDialog({
  open,
  onOpenChange,
  storeId,
  categories,
  product,
  storeType,
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
  const [isActive, setIsActive] = useState(true);
  const [hasVariants, setHasVariants] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [variants, setVariants] = useState<VariantForm[]>([]);
  const [productImages, setProductImages] = useState<ImageForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);

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
      setIsActive(product.isActive);
      setHasVariants(product.hasVariants);
      setImagePreview(product.image || null);
      setImageFile(null);
      setDurationMinutes(String(product.durationMinutes ?? 30));
      setProfessionalIds(product.professionalIds || []);
      setVariants(
        product.variants?.map(v => ({
          color: v.color || '',
          size: v.size || '',
          price: v.price,
          stock: v.stock,
          sku: v.sku,
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
      setIsActive(true);
      setHasVariants(false);
      setImagePreview(null);
      setImageFile(null);
      setVariants([]);
      setProductImages([]);
      setDurationMinutes('30');
      setProfessionalIds([]);
      setAssemblyMode('fixed');
      setAllowObservation(false);
      setAllowBorder(false);
      setDefaultIngredientIds([]);
      setLimitsByVariant({});
    }
  }, [product, open, assemblies]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
    setVariants(prev => [...prev, { color: '', size: '', price: Number(basePrice) || 0, stock: 0, sku: '' }]);
  };

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantForm, value: string | number) => {
    setVariants(prev =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
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
            price: v.price,
            stock: v.stock,
            sku: v.sku,
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
          imageUrl: imageUrl,
          isActive,
          hasVariants,
          variants: variantData,
          images: hasVariants ? uploadedImages : [],
          durationMinutes: isSalon ? Number(durationMinutes) || 30 : undefined,
          professionalIds: isSalon ? professionalIds : undefined,
        });
        if (isFood) {
          await upsertAssembly.mutateAsync({
            productId: product.id,
            mode: assemblyMode,
            allowObservation,
            allowBorder,
            defaultIngredientIds,
            limitsByVariant,
          });
        }
        toast.success('Produto atualizado!');
      } else {
        const created = await createProduct.mutateAsync({
          storeId,
          code,
          name,
          description,
          categoryId: categoryId || null,
          basePrice: Number(basePrice) || 0,
          imageUrl: imageUrl || undefined,
          isActive,
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
        toast.success('Produto criado!');
      }

      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar produto');
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
              <Label htmlFor="price">{isSalon ? 'Preço (R$)' : 'Preço Base'}</Label>
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
                <div key={i} className="grid grid-cols-6 gap-2 items-end">
                  <div>
                    <Label className="text-xs">Cor</Label>
                    <Input value={v.color} onChange={e => updateVariant(i, 'color', e.target.value)} placeholder="Azul" />
                  </div>
                  <div>
                    <Label className="text-xs">Tamanho</Label>
                    <Input value={v.size} onChange={e => updateVariant(i, 'size', e.target.value)} placeholder="M" />
                  </div>
                  <div>
                    <Label className="text-xs">Preço</Label>
                    <Input type="number" step="0.01" value={v.price} onChange={e => updateVariant(i, 'price', Number(e.target.value))} />
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
