import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuantityStepperProps {
  value: number;
  onChange: (qty: number) => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  disabled?: boolean;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
  inputReadOnly?: boolean;
  className?: string;
  buttonVariant?: 'ghost' | 'outline';
}

export default function QuantityStepper({
  value,
  onChange,
  onIncrement,
  onDecrement,
  disabled = false,
  decrementDisabled = false,
  incrementDisabled = false,
  inputReadOnly = false,
  className = '',
  buttonVariant = 'ghost',
}: QuantityStepperProps) {
  const [text, setText] = useState(String(value));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);

  const commit = () => {
    editing.current = false;
    const parsed = parseInt(text.replace(/\D/g, ''), 10);
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    setText(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={`flex items-center gap-1 rounded-md border ${className}`}>
      <Button
        size="icon"
        variant={buttonVariant}
        className="h-7 w-7 shrink-0"
        aria-label="Diminuir quantidade"
        disabled={disabled || decrementDisabled}
        onClick={(e) => {
          e.stopPropagation();
          if (onDecrement) onDecrement();
          else onChange(Math.max(0, value - 1));
        }}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="Quantidade"
        value={text}
        readOnly={inputReadOnly}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => { editing.current = true; e.currentTarget.select(); }}
        onChange={(e) => { editing.current = true; setText(e.target.value.replace(/\D/g, '')); }}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className="h-7 w-10 border-0 bg-transparent p-0 text-center text-sm font-semibold outline-none focus:ring-0 disabled:opacity-50"
      />
      <Button
        size="icon"
        variant={buttonVariant}
        className="h-7 w-7 shrink-0"
        aria-label="Aumentar quantidade"
        disabled={disabled || incrementDisabled}
        onClick={(e) => {
          e.stopPropagation();
          if (onIncrement) onIncrement();
          else onChange(value + 1);
        }}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}