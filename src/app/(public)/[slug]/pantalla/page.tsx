import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScreenBoard } from "@/components/queue/ScreenBoard";
import { getScreenQueue } from "@/lib/actions/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pantalla", robots: { index: false, follow: false } };

/** REQ-013: /[slug]/pantalla?k=<screen_key> */
export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const key = typeof sp.k === "string" ? sp.k : "";
  const view = await getScreenQueue(slug, key);
  if (!view) notFound();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return <ScreenBoard initial={view} slug={slug} screenKey={key} queueUrl={`${base}/${slug}`} />;
}
