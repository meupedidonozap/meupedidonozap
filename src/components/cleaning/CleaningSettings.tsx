import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "./CleaningFields";
import { Check, Loader2 } from "lucide-react";
import { useCleaningActions } from "@/hooks/useCleaning";
import { supabase } from "@/integrations/supabase/client";
import { cleaningWhatsApp } from "@/lib/cleaning";
import type { Store } from "@/types";
import { toast } from "sonner";
export default function CleaningSettings({ store }: { store: Store }) {
  const actions = useCleaningActions(store.id);
  const [name, setName] = useState(store.name);
  const [whatsapp, setWhatsapp] = useState(store.whatsapp);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-8">
      <form
        className="grid max-w-xl gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || !cleaningWhatsApp(whatsapp, "")) {
            toast.error("Informe nome e WhatsApp com DDD.");
            return;
          }
          setBusy(true);
          try {
            await actions.run(() =>
              supabase
                .from("stores")
                .update({
                  name: name.trim(),
                  whatsapp: whatsapp.replace(/\D/g, ""),
                })
                .eq("id", store.id)
                .select()
                .single(),
            );
            toast.success("Configurações salvas.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-lg">Empresa</h2>
        <Field label="Nome da loja" value={name} onChange={setName} required />
        <Field
          label="WhatsApp de recebimento"
          value={whatsapp}
          onChange={setWhatsapp}
          required
        />
        <Button className="justify-self-start" type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}Salvar
          configurações
        </Button>
      </form>
      <section className="border-t pt-6">
        <h2 className="mb-3 text-lg">Regras da loja</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Serviços cobrados por metro quadrado, com preços por produto e
          adicionais cadastrados em Serviços. Orçamentos sem preço aguardam
          avaliação da empresa. O cliente aceita o valor disponível antes de
          solicitar o agendamento. Horários solicitados aguardam confirmação da
          empresa; horários confirmados e bloqueados não podem se sobrepor.
          Orçamento aceito gera atendimento e conta a receber. Recebimento da
          compra atualiza estoque; pagamento gera movimento de caixa. Dados
          exclusivos desta loja.
        </p>
      </section>
    </div>
  );
}
