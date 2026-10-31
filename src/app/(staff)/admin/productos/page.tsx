import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { ProductForm, type ProductRow } from "@/components/admin/ItemForms";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductsPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, price, is_active, for_sale, is_courtesy, photo_path")
    .eq("business_id", session.business.id)
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("name");
  const products = (data ?? []) as ProductRow[];

  return (
    <main className="pb-6">
      <AdminNav current="/admin/productos" />
      <h1 className="text-2xl font-bold">Productos</h1>
      <p className="text-muted mt-1 text-sm">
        Helados, bebidas y lo que vendas sin cita. Los de cortesía se ofrecen gratis con el turno.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {products.map((p) => (
          <ProductForm key={p.id} product={p} businessId={session.business.id} />
        ))}
        <h2 className="mt-2 font-semibold">Nuevo producto</h2>
        <ProductForm businessId={session.business.id} />
      </div>
    </main>
  );
}
