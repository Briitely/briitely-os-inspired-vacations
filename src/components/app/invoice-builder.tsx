"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent } from "@/components/core/ui/card";
import { CustomerDetailsCard } from "@/components/core/customer-details-card";
import {
  InvoiceLine,
  createEmptyLine,
  type InvoiceLineData,
} from "@/components/core/invoice-line";
import type { ProductPriceOption } from "@/components/core/product-price-select";
import { formatCurrency } from "@/lib/briitely/pricing";
import type { BriitelyCustomer, BriitelyProductWithPrices } from "@/lib/briitely/types";

interface CatalogResponse {
  items?: BriitelyProductWithPrices[];
  productCount?: number;
  priceCount?: number;
  error?: string;
}

export interface InvoiceBuilderProps {
  customer: BriitelyCustomer;
  lines: InvoiceLineData[];
  onLinesChange: (lines: InvoiceLineData[]) => void;
  onReview: () => void;
  onChangeCustomer: () => void;
  onCustomerUpdated: (customer: BriitelyCustomer) => void;
  onBack: () => void;
  allowChangeCustomer?: boolean;
  commissionSale?: boolean;
  onCommissionSaleChange?: (value: boolean) => void;
}

export function InvoiceBuilder({ customer, lines, onLinesChange, onReview, onChangeCustomer, onCustomerUpdated, onBack, allowChangeCustomer = true, commissionSale = false, onCommissionSaleChange }: InvoiceBuilderProps) {
  const [catalog, setCatalog] = useState<BriitelyProductWithPrices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/products");
        const data = (await response.json()) as CatalogResponse;
        if (!response.ok) {
          throw new Error(data.error || "We couldn't load the product list.");
        }
        if (!cancelled) {
          setCatalog(data.items ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We couldn't load the product list. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleProductChange(lineId: string, option: ProductPriceOption | null) {
    onLinesChange(lines.map((line) => {
        if (line.lineId !== lineId) return line;
        if (!option) {
          return createEmptyLine();
        }
        const quantity = Math.max(1, line.quantity);
        return {
          lineId,
          productId: option.productId,
          priceId: option.priceId,
          productName: option.productName,
          priceName: option.priceName,
          unitPrice: option.amount,
          quantity,
          subtotal: option.amount * quantity,
          currency: option.currency || "CAD",
        };
      }));
  }

  function handleQuantityChange(lineId: string, quantity: number) {
    onLinesChange(lines.map((line) =>
      line.lineId === lineId && line.productId
        ? {
            ...line,
            quantity: Math.max(1, quantity),
            subtotal: line.unitPrice * Math.max(1, quantity),
          }
        : line
    ));
  }

  function handlePriceChange(lineId: string, unitPrice: number) {
    onLinesChange(lines.map((line) =>
      line.lineId === lineId && line.productId
        ? {
            ...line,
            unitPrice,
            subtotal: unitPrice * line.quantity,
          }
        : line
    ));
  }

  function handleRemove(lineId: string) {
    const filtered = lines.filter((line) => line.lineId !== lineId);
    onLinesChange(filtered.length > 0 ? filtered : [createEmptyLine()]);
  }

  function handleAddLine() {
    onLinesChange([...lines, createEmptyLine()]);
  }

  const configuredLines = lines.filter(
    (line) => line.productId && line.priceId
  );

  const subtotal = useMemo(
    () => configuredLines.reduce((sum, line) => sum + line.subtotal, 0),
    [configuredLines]
  );

  const subtotalCurrency = configuredLines[0]?.currency ?? "CAD";
  const canReview = configuredLines.length > 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="-ml-3" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <CustomerDetailsCard
        customer={customer}
        onCustomerUpdated={onCustomerUpdated}
        onChangeCustomer={onChangeCustomer}
        showChangeCustomer={allowChangeCustomer}
      />

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <input
          id="commission-sale"
          type="checkbox"
          checked={commissionSale}
          onChange={(e) => onCommissionSaleChange?.(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <label htmlFor="commission-sale" className="text-sm font-medium cursor-pointer select-none">
          Commission Sale
        </label>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Products</h2>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading products...</span>
          </div>
        ) : error ? (
          <Card className="border-destructive/30">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-destructive" role="alert">{error}</p>
            </CardContent>
          </Card>
        ) : catalog.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No products are currently available.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <InvoiceLine
                key={line.lineId}
                line={line}
                catalog={catalog}
                onProductChange={handleProductChange}
                onQuantityChange={handleQuantityChange}
                onPriceChange={handlePriceChange}
                onRemove={handleRemove}
                canRemove={lines.length > 1}
              />
            ))}

            <Button
              variant="outline"
              onClick={handleAddLine}
              className="w-full border-dashed"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        )}
      </div>

      {canReview && (
        <Card className="border-primary/20">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-lg font-semibold">Subtotal</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(subtotal, subtotalCurrency)}
              </span>
            </div>
            <Button size="lg" className="w-full" disabled={!canReview} onClick={onReview}>
              Review Invoice
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
