import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';

export default function PaymentReturnPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const pending = params.get('redirect_status') === 'processing';
  const failed = !sessionId;
  const Icon = failed ? XCircle : pending ? Clock : CheckCircle;

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <main className="container flex min-h-[75vh] items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-5 p-8 text-center">
            <Icon className={`mx-auto h-14 w-14 ${failed ? 'text-destructive' : 'text-accent'}`} />
            <div>
              <h1 className="text-2xl font-bold">{failed ? 'Pagamento não concluído' : pending ? 'Pagamento em processamento' : 'Pedido recebido'}</h1>
              <p className="mt-2 text-muted-foreground">
                {failed ? 'Tente novamente pela loja.' : 'A Mabelle atualizará o pedido automaticamente após a confirmação.'}
              </p>
            </div>
            <Button asChild className="w-full"><Link to="/mabelle">Voltar à Mabelle</Link></Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}