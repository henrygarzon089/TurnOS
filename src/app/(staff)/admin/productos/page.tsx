import type { Metadata } from "next";
import Link from "next/link";
import { NewProductButton, ProductGrid } from "@/components/admin/CatalogLists";
import { type ProductRow } from "@/components/admin/ItemForms";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { getInventoryOverview } from "@/lib/actions/inventory";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Productos" };

/** Vitrina del dueño (REQ-024, REQ-038.1, REQ-065; tablero Dueno-Local): filtro por categoría. */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: biz }, inventory] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, price, is_active, for_sale, is_courtesy, photo_path, commissionable, category",
      )
      .eq("business_id", session.business.id)
      .order("is_active", { ascending: false })
      .order("sort_order")
      .order("name"),
    supabase
      .from("businesses")
      .select("product_commission_pct")
      .eq("id", session.business.id)
      .single(),
    // "categoría · existencias" cuando el producto está en la vitrina del inventario (§22.8)
    getInventoryOverview().catch(() => null),
  ]);
  const stock: Record<string, { qty: number; low: boolean }> = {};
  for (const i of inventory?.items ?? []) {
    if (!i.productId || i.shelfMin === null) continue;
    stock[i.productId] = { qty: i.shelf, low: i.shelf <= i.shelfMin };
  }
  const products = (data ?? []) as ProductRow[];
  // REQ-065.3 sugerencias con las categorías que ya existen
  const categories = [...new Set(products.map((p) => p.category).filter((c) => c !== null))].sort();
  const shown = categoria ? products.filter((p) => p.category === categoria) : products;
  const filters = [{ label: "Todas", href: "/admin/productos", active: !categoria }].concat(
    categories.map((c) => ({
      label: c,
      href: `/admin/productos?categoria=${encodeURIComponent(c)}`,
      active: c === categoria,
    })),
  );

  return (
    <main className="pb-6">
      <PageHeader
        title="Productos"
        subtitle="Helados, bebidas y lo que vendas sin cita. Los de cortesía se ofrecen gratis con el turno."
      />
      <Panel className="mt-4" aria-label="Vitrina">
        <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          {categories.length > 0 ? (
            <nav aria-label="Categorías" className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <Link
                  key={f.href}
                  href={f.href}
                  aria-current={f.active ? "page" : undefined}
                  className={`inline-flex min-h-12 items-center rounded-sm px-4 text-base ${
                    f.active
                      ? "border-brand bg-brand-soft text-ink border-2 font-bold"
                      : "border-line-strong bg-card text-ink border"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </nav>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-3">
            {biz && (
              <p className="text-muted flex items-center gap-1 text-base">
                Comisión de productos:{" "}
                <span className="text-ink font-bold">{biz.product_commission_pct} %</span>
                <Link
                  href="/admin/negocio"
                  className="text-brand inline-flex min-h-12 items-center px-1 font-semibold underline underline-offset-4"
                >
                  Cambiar
                </Link>
              </p>
            )}
            <NewProductButton businessId={session.business.id} categories={categories} />
          </div>
        </div>
        {shown.length > 0 ? (
          <ProductGrid
            products={shown}
            stock={stock}
            businessId={session.business.id}
            categories={categories}
          />
        ) : categoria ? (
          <EmptyState
            icon="cup"
            title={`No hay productos en ${categoria}`}
            text="Escoge otra categoría o ponle esta categoría a un producto al editarlo."
            action={
              <Link href="/admin/productos" className="btn-secondary px-5">
                Ver todos
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon="cup"
            title="Todavía no hay productos"
            text="Agrega lo que vendes en la vitrina con el botón Nuevo producto."
          />
        )}
      </Panel>
    </main>
  );
}
