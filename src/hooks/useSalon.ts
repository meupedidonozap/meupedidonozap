import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SalonProfessional, SalonService, SalonAppointment, SalonAppointmentStatus } from '@/types';

function mapProfessional(row: any): SalonProfessional {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    photoUrl: row.photo_url || undefined,
    bio: row.bio || undefined,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function mapService(row: any, profIds: string[] = []): SalonService {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    durationMinutes: row.duration_minutes,
    imageUrl: row.image_url || undefined,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    professionalIds: profIds,
  };
}

function mapAppointment(row: any): SalonAppointment {
  return {
    id: row.id,
    storeId: row.store_id,
    professionalId: row.professional_id,
    serviceId: row.service_id || undefined,
    orderId: row.order_id || undefined,
    customerName: row.customer_name,
    customerWhatsapp: row.customer_whatsapp || undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as SalonAppointmentStatus,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

// ==== Professionals ====
export function useSalonProfessionals(storeId?: string) {
  return useQuery({
    queryKey: ['salon-professionals', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salon_professionals')
        .select('*')
        .eq('store_id', storeId!)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapProfessional);
    },
    enabled: !!storeId,
  });
}

export function useUpsertProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<SalonProfessional> & { storeId: string; name: string }) => {
      const payload: any = {
        store_id: p.storeId,
        name: p.name,
        photo_url: p.photoUrl || null,
        bio: p.bio || null,
        is_active: p.isActive ?? true,
        sort_order: p.sortOrder ?? 0,
      };
      if (p.id) {
        const { error } = await supabase.from('salon_professionals').update(payload).eq('id', p.id).select('id').single();
        if (error) throw error;
      } else {
        const { error } = await supabase.from('salon_professionals').insert(payload).select('id').single();
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['salon-professionals', v.storeId] }),
  });
}

export function useDeleteProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; storeId: string }) => {
      const { error } = await supabase.from('salon_professionals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['salon-professionals', v.storeId] }),
  });
}

// ==== Services ====
export function useSalonServices(storeId?: string) {
  return useQuery({
    queryKey: ['salon-services', storeId],
    queryFn: async () => {
      const { data: services, error } = await supabase
        .from('salon_services')
        .select('*')
        .eq('store_id', storeId!)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      const ids = (services || []).map(s => s.id);
      let links: any[] = [];
      if (ids.length) {
        const { data: linkRows, error: linkErr } = await supabase
          .from('salon_service_professionals')
          .select('*')
          .in('service_id', ids);
        if (linkErr) throw linkErr;
        links = linkRows || [];
      }
      return (services || []).map(s => mapService(s, links.filter(l => l.service_id === s.id).map(l => l.professional_id)));
    },
    enabled: !!storeId,
  });
}

export function useUpsertService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<SalonService> & { storeId: string; name: string; durationMinutes: number; price: number; professionalIds: string[] }) => {
      const payload: any = {
        store_id: p.storeId,
        name: p.name,
        description: p.description || '',
        price: p.price,
        duration_minutes: p.durationMinutes,
        image_url: p.imageUrl || null,
        is_active: p.isActive ?? true,
        sort_order: p.sortOrder ?? 0,
      };
      let serviceId = p.id;
      if (serviceId) {
        const { error } = await supabase.from('salon_services').update(payload).eq('id', serviceId).select('id').single();
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('salon_services').insert(payload).select('id').single();
        if (error) throw error;
        serviceId = data.id;
      }
      // Replace professionals links
      await supabase.from('salon_service_professionals').delete().eq('service_id', serviceId);
      if (p.professionalIds.length) {
        const rows = p.professionalIds.map(pid => ({ service_id: serviceId, professional_id: pid }));
        const { error } = await supabase.from('salon_service_professionals').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['salon-services', v.storeId] }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; storeId: string }) => {
      const { error } = await supabase.from('salon_services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['salon-services', v.storeId] }),
  });
}

// ==== Appointments ====
export function useSalonAppointments(storeId?: string, fromIso?: string, toIso?: string) {
  return useQuery({
    queryKey: ['salon-appointments', storeId, fromIso, toIso],
    queryFn: async () => {
      let q = supabase.from('salon_appointments').select('*').eq('store_id', storeId!);
      if (fromIso) q = q.gte('starts_at', fromIso);
      if (toIso) q = q.lte('starts_at', toIso);
      const { data, error } = await q.order('starts_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapAppointment);
    },
    enabled: !!storeId,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      storeId: string;
      professionalId: string;
      serviceId?: string;
      orderId?: string;
      customerName: string;
      customerWhatsapp?: string;
      startsAt: string;
      endsAt: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.from('salon_appointments').insert({
        store_id: p.storeId,
        professional_id: p.professionalId,
        service_id: p.serviceId || null,
        order_id: p.orderId || null,
        customer_name: p.customerName,
        customer_whatsapp: p.customerWhatsapp || null,
        starts_at: p.startsAt,
        ends_at: p.endsAt,
        status: 'reservado',
        notes: p.notes || null,
      }).select().single();
      if (error) {
        if (String(error.message).toLowerCase().includes('overlap') || (error as any).code === '23P01') {
          throw new Error('Esse horário acabou de ser reservado. Escolha outro.');
        }
        throw error;
      }
      return mapAppointment(data);
    },
    onSuccess: (a) => qc.invalidateQueries({ queryKey: ['salon-appointments', a.storeId] }),
  });
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; storeId: string; status: SalonAppointmentStatus }) => {
      const { error } = await supabase.from('salon_appointments').update({ status }).eq('id', id).select('id').single();
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['salon-appointments', v.storeId] }),
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; storeId: string }) => {
      const { error } = await supabase.from('salon_appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['salon-appointments', v.storeId] }),
  });
}