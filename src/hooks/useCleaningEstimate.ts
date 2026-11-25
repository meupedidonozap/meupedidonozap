import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { readEstimateSettings, type SiteAddress } from "@/lib/cleaningMeasurements";

export function useCleaningEstimateSettings(storeId: string) {
  return useQuery({ queryKey: ["cleaning", "estimate-settings", storeId], queryFn: async () => {
    const { data, error } = await supabase.from("stores").select("settings").eq("id", storeId).single();
    if (error) throw error;
    return readEstimateSettings(data.settings);
  }, staleTime: 0, refetchOnWindowFocus: true });
}
export type CleaningTravelEstimate = { id: string; one_way_meters: number; total_km: number; total: number };
export async function estimateCleaningTravel(storeId: string, siteAddress: SiteAddress): Promise<CleaningTravelEstimate> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Entre na loja para calcular o deslocamento.");
  const { data, error } = await supabase.functions.invoke("cleaning-travel", { body: { store_id: storeId, site_address: siteAddress } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error || "Não foi possível calcular o deslocamento.");
    }
    throw new Error("Não foi possível calcular o deslocamento. Tente novamente.");
  }
  return data as CleaningTravelEstimate;
}