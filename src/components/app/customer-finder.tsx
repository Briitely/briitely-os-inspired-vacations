"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  Phone,
  Search,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/core/ui/badge";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import type { BriitelyCustomer } from "@/lib/briitely/types";
import { classifyQuery, splitNameParts } from "@/lib/briitely/query";
import { formatPhoneNumber } from "@/lib/format/phone";

interface SearchResponse {
  customers?: BriitelyCustomer[];
  total?: number;
  queryType?: string;
  searchCount?: number;
  error?: string;
}

interface CreateResponse {
  customer?: BriitelyCustomer;
  duplicate?: boolean;
  created?: boolean;
  error?: string;
}

interface CreateFormData {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
}

const EMPTY_FORM: CreateFormData = {
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  address1: "",
  city: "",
  state: "",
  postalCode: "",
};


function CustomerCard({ customer, onSelect }: { customer: BriitelyCustomer; onSelect: (customer: BriitelyCustomer) => void }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{customer.companyName || customer.name || "Unnamed customer"}</h2>
            {customer.companyName && customer.name && <Badge variant="secondary">{customer.name}</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {customer.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" />{formatPhoneNumber(customer.phone)}</span>}
            {customer.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" />{customer.email}</span>}
          </div>
        </div>
        <Button onClick={() => onSelect(customer)} className="shrink-0">Select Customer</Button>
      </CardContent>
    </Card>
  );
}

function prepopulateForm(query: string): CreateFormData {
  const classification = classifyQuery(query);
  const form = { ...EMPTY_FORM };

  if (classification.type === "email") {
    form.email = classification.normalized;
  } else {
    const parts = splitNameParts(classification.normalized);
    if (parts.firstName && parts.lastName) {
      form.firstName = parts.firstName;
      form.lastName = parts.lastName;
    } else if (parts.firstName) {
      form.companyName = parts.firstName;
    }
  }

  return form;
}

type View = "search" | "create" | "duplicate";

interface CustomerFinderProps {
  onCustomerSelected?: (customer: BriitelyCustomer) => void;
  initialCustomerId?: string;
}

export function CustomerFinder({ onCustomerSelected, initialCustomerId }: CustomerFinderProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<BriitelyCustomer[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialCustomerId));
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("search");
  const [createForm, setCreateForm] = useState<CreateFormData>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<BriitelyCustomer | null>(null);

  const handleNavigateToCustomer = useCallback((customerId: string) => {
    router.push(`/customers/${encodeURIComponent(customerId)}`);
  }, [router]);

  useEffect(() => {
    if (!initialCustomerId) return;
    let active = true;
    fetch(`/api/customers/${encodeURIComponent(initialCustomerId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { customer?: BriitelyCustomer; error?: string };
        if (!response.ok || !data.customer) throw new Error(data.error || "We couldn't load this customer.");
        if (active) {
          if (onCustomerSelected) {
            onCustomerSelected(data.customer);
          } else {
            handleNavigateToCustomer(data.customer.id);
          }
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "We couldn't load this customer.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialCustomerId, onCustomerSelected, handleNavigateToCustomer]);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setError("Enter at least 2 characters to search.");
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setView("search");
    try {
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(trimmedQuery)}`);
      const data = (await response.json()) as SearchResponse;
      if (!response.ok) {
        throw new Error(data.error || "We couldn't complete that search.");
      }
      setCustomers(data.customers ?? []);
      setSearched(true);
    } catch (searchError) {
      setCustomers([]);
      setSearched(false);
      setError(searchError instanceof Error ? searchError.message : "We couldn't complete that search.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectCustomer(customer: BriitelyCustomer) {
    if (onCustomerSelected) {
      onCustomerSelected(customer);
      return;
    }
    handleNavigateToCustomer(customer.id);
  }

  function handleStartCreate() {
    setCreateForm(prepopulateForm(query));
    setCreateError(null);
    setView("create");
  }

  function handleCancelCreate() {
    setView("search");
    setCreateError(null);
    setDuplicateMatch(null);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/customers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = (await response.json()) as CreateResponse;

      if (!response.ok) {
        throw new Error(data.error || "We couldn't create this customer.");
      }

      if (data.duplicate && data.customer) {
        setDuplicateMatch(data.customer);
        setView("duplicate");
        return;
      }

      if (data.customer) {
        handleNavigateToCustomer(data.customer.id);
      }
    } catch (createError) {
      setCreateError(
        createError instanceof Error ? createError.message : "We couldn't create this customer."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleForceCreate() {
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/customers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createForm, forceCreate: true }),
      });
      const data = (await response.json()) as CreateResponse;

      if (!response.ok) {
        throw new Error(data.error || "We couldn't create this customer.");
      }

      if (data.customer) {
        handleNavigateToCustomer(data.customer.id);
      }
    } catch (createError) {
      setCreateError(
        createError instanceof Error ? createError.message : "We couldn't create this customer."
      );
    } finally {
      setCreating(false);
    }
  }

  if (view === "create") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Button variant="ghost" className="w-fit -ml-3" onClick={handleCancelCreate}>
              <ArrowLeft className="h-4 w-4" />
              Back to Search
            </Button>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create New Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Business Name</Label>
                <Input
                  id="companyName"
                  value={createForm.companyName}
                  onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="(780) 555-1234"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address1">Address</Label>
                <Input
                  id="address1"
                  value={createForm.address1}
                  onChange={(e) => setCreateForm({ ...createForm, address1: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Province</Label>
                  <Input
                    id="state"
                    value={createForm.state}
                    onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={createForm.postalCode}
                    onChange={(e) => setCreateForm({ ...createForm, postalCode: e.target.value })}
                  />
                </div>
              </div>

              {createError && (
                <p className="text-sm text-destructive" role="alert">{createError}</p>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {creating ? "Creating..." : "Create Customer"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelCreate} disabled={creating}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "duplicate" && duplicateMatch) {
    return (
      <div className="space-y-4">
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Possible existing customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A customer with matching email or phone was found. Would you like to use the existing customer or create a new one anyway?
            </p>
            <CustomerCard customer={duplicateMatch} onSelect={handleSelectCustomer} />
            <div className="flex gap-3">
              <Button onClick={handleForceCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create New Anyway
              </Button>
              <Button variant="outline" onClick={handleCancelCreate} disabled={creating}>
                Back to Form
              </Button>
            </div>
            {createError && <p className="text-sm text-destructive" role="alert">{createError}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, business, or email"
                className="h-12 pl-10"
                aria-label="Search customers"
              />
            </div>
            <Button type="submit" size="lg" disabled={loading} className="sm:min-w-32">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              Search
            </Button>
          </form>
          {loading && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching customers...
            </p>
          )}
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        </CardContent>
      </Card>

      {searched && !loading && customers.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{customers.length} customer{customers.length === 1 ? "" : "s"} found</p>
          {customers.map((customer) => <CustomerCard key={customer.id} customer={customer} onSelect={handleSelectCustomer} />)}
          <div className="pt-2">
            <Button variant="outline" onClick={handleStartCreate}>
              <UserPlus className="h-4 w-4" />
              Create New Customer
            </Button>
          </div>
        </div>
      )}

      {searched && !loading && customers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><Building2 className="h-6 w-6" /></div>
            <h2 className="text-lg font-semibold">No customer found.</h2>
            <p className="max-w-sm text-sm text-muted-foreground">We couldn&apos;t find a matching customer. Create a new one to get started.</p>
            <Button onClick={handleStartCreate}>
              <UserPlus className="h-4 w-4" />
              Create New Customer
            </Button>
          </CardContent>
        </Card>
      )}

      {!searched && !loading && (
        <div className="pt-2">
          <Button variant="outline" onClick={handleStartCreate}>
            <UserPlus className="h-4 w-4" />
            Create New Customer
          </Button>
        </div>
      )}
    </div>
  );
}
