import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

/** Alterna entre tema claro e escuro; a escolha fica salva no navegador do usuário. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-3" aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {dark ? 'Claro' : 'Escuro'}
    </Button>
  );
}
