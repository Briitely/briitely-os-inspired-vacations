"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import {
  ProductPriceSelect,
  type ProductPriceOption,
} from "@/components/core/product-price-select";
import { formatCurrency } from "@/lib/briitely/pricing";
import type { BriitelyProductWithPrices } from "@/lib/briitely/types";

export interface InvoiceLineData {
  lineId: string;
  productId: string;
  priceId: string;
  productName: string;
  priceName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  currency: string;
}

export function createLineId(): string {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyLine(): InvoiceLineData {
  return {
    lineId: createLineId(),
    productId: "",
    priceId: "",
    productName: "",
    priceName: "",
    unitPrice: 0,
    quantity: 1,
    subtotal: 0,
    currency: "CAD",
  };
}

export interface InvoiceLineProps {
  line: InvoiceLineData;
  catalog: BriitelyProductWithPrices[];
  onProductChange: (lineId: string, option: ProductPriceOption | null) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onPriceChange: (lineId: string, unitPrice: number) => void;
  onRemove: (lineId: string) => void;
  canRemove: boolean;
}

export function InvoiceLine({
  line,
  catalog,
  onProductChange,
  onQuantityChange,
  onPriceChange,
  onRemove,
  canRemove,
}: InvoiceLineProps) {
  const selectedOption: ProductPriceOption | null = line.productId
    ? {
        productId: line.productId,
        priceId: line.priceId,
        productName: line.productName,
        priceName: line.priceName,
        amount: line.unitPrice,
        currency: line.currency,
      }
    : null;

  const isConfigured = line.productId.length > 0 && line.priceId.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
        <div className="md:col-span-5">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Item
          </label>
          <ProductPriceSelect
            catalog={catalog}
            value={selectedOption}
            onChange={(option) => onProductChange(line.lineId, option)}
            placeholder="Select Product"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Price
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={isConfigured ? line.unitPrice.toFixed(2) : "0.00"}
              onChange={(event) => {
                const parsed = parseFloat(event.target.value);
                if (!Number.isNaN(parsed) && parsed >= 0) {
                  onPriceChange(line.lineId, Number(parsed.toFixed(2)));
                }
              }}
              disabled={!isConfigured}
              className="h-11 pl-7 text-sm"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Quantity
          </label>
          <div className="flex items-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-r-none"
              onClick={() => onQuantityChange(line.lineId, line.quantity - 1)}
              disabled={line.quantity <= 1 || !isConfigured}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(event) => {
                const parsed = parseInt(event.target.value, 10);
                if (!Number.isNaN(parsed) && parsed >= 1) {
                  onQuantityChange(line.lineId, parsed);
                }
              }}
              disabled={!isConfigured}
              className="h-11 rounded-none border-x-0 text-center text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-l-none"
              onClick={() => onQuantityChange(line.lineId, line.quantity + 1)}
              disabled={!isConfigured}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Subtotal
          </label>
          <p className="flex h-11 items-center text-sm font-semibold">
            {formatCurrency(line.subtotal, line.currency)}
          </p>
        </div>

        <div className="flex items-end justify-end md:col-span-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(line.lineId)}
            disabled={!canRemove && !isConfigured}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
