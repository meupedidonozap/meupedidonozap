import { Helmet } from 'react-helmet-async';

/**
 * Aplica meta robots noindex,nofollow para impedir indexação
 * de páginas privadas (admin, checkout, histórico, cozinha, etc.).
 */
export default function NoIndex() {
  return (
    <Helmet>
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
  );
}