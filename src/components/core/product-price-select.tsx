"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/briitely/pricing";
import type { BriitelyProductWithPrices } from "@/lib/briitely/types";

export interface ProductPriceOption {
  productId: string;
  priceId: string;
  productName: string;
  priceName: string;
  amount: number;
  currency: string;
}

export interface ProductPriceSelectProps {
  catalog: BriitelyProductWithPrices[];
  value: ProductPriceOption | null;
  onChange: (option: ProductPriceOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

function optionLabel(option: ProductPriceOption): string {
  const pricePart = option.priceName ? ` — ${option.priceName}` : "";
  return `${option.productName}${pricePart}`;
}

function buildOptions(catalog: BriitelyProductWithPrices[]): ProductPriceOption[] {
  const options: ProductPriceOption[] = [];
  for (const { product, prices } of catalog) {
    for (const price of prices) {
      options.push({
        productId: product.id,
        priceId: price.id,
        productName: product.name,
        priceName: price.name,
        amount: price.amount,
        currency: price.currency,
      });
    }
  }
  return options;
}

export function ProductPriceSelect({
  catalog,
  value,
  onChange,
  disabled,
  placeholder = "Select Product",
}: ProductPriceSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => buildOptions(catalog), [catalog]);

  const grouped = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? options.filter(
          (option) =>
            option.productName.toLowerCase().includes(normalizedQuery) ||
            option.priceName.toLowerCase().includes(normalizedQuery) ||
            optionLabel(option).toLowerCase().includes(normalizedQuery)
        )
      : options;

    const groups = new Map<string, ProductPriceOption[]>();
    for (const option of filtered) {
      const existing = groups.get(option.productName) ?? [];
      existing.push(option);
      groups.set(option.productName, existing);
    }
    return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function handleSelect(option: ProductPriceOption | null) {
    onChange(option);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition-colors",
          "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {value ? optionLabel(value) : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products..."
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1">
            {grouped.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matching products.
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.name} className="py-1">
                  <p className="px-3 pb-1 pt-2 text-sm font-bold tracking-wide text-foreground/90">
                    {group.name}
                  </p>
                  {group.items.map((option) => {
                    const isSelected =
                      value?.priceId === option.priceId && value?.productId === option.productId;
                    return (
                      <button
                        type="button"
                        key={option.priceId}
                        onClick={() => handleSelect(option)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-1.5 pl-5 text-left text-sm font-normal transition-colors hover:bg-accent",
                          isSelected && "bg-accent/60"
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                          <span className="truncate">
                            {option.priceName || "Default price"}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium text-muted-foreground">
                          {formatCurrency(option.amount, option.currency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
