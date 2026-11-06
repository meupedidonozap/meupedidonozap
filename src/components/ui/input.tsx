import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const SEARCH_PLACEHOLDER = /^\s*(buscar|pesquisar)/i;
const WRAPPER_CLASS = /^([a-z0-9]+:)*(w-|max-w-|min-w-|flex-1|basis-)/;

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const setRefs = (el: HTMLInputElement | null) => {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
    };
    const isSearch =
      type === "search" ||
      (typeof props.placeholder === "string" && SEARCH_PLACEHOLDER.test(props.placeholder));
    const hasValue = props.value !== undefined && props.value !== null && String(props.value) !== "";

    const baseClass =
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

    if (!isSearch || !props.onChange) {
      return <input type={type} className={cn(baseClass, className)} ref={setRefs} {...props} />;
    }

    const parts = (className || "").split(/\s+/).filter(Boolean);
    const wrapperParts = parts.filter((c) => WRAPPER_CLASS.test(c));
    const inputParts = parts.filter((c) => !WRAPPER_CLASS.test(c));

    const clear = () => {
      const el = innerRef.current;
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(el, "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    };

    return (
      <div className={cn("relative w-full", wrapperParts.join(" "))}>
        <input
          type={type === "search" ? "text" : type}
          className={cn(baseClass, inputParts.join(" "), "pr-9")}
          ref={setRefs}
          {...props}
        />
        {hasValue && !props.disabled && (
          <button
            type="button"
            aria-label="Limpar pesquisa"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
