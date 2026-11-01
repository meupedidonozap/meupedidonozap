import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

/** Alterna entre tema claro e escuro; a escolha fica salva no navegador do usuário. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <Button variant="ghost" size="icon" aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} title={dark ? 'Tema claro' : 'Tema escuro'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
