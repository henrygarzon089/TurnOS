import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/** T-132 · Speed Insights montado en toda la app con la URL limpia (design.md §19.2). */
const props = vi.hoisted(
  () => [] as { beforeSend?: (e: { type: "vital"; url: string }) => unknown }[],
);
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: (p: (typeof props)[number]) => {
    props.push(p);
    return null;
  },
}));
vi.mock("@/components/ui/ServiceWorker", () => ({ ServiceWorker: () => null }));
vi.mock("@/app/globals.css", () => ({}));

const { default: RootLayout } = await import("@/app/layout");

describe("VitalsReporter (REQ-075.3)", () => {
  it("REQ-075.3 el layout raíz monta Speed Insights en todas las rutas", () => {
    renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <main />
      </RootLayout>,
    );
    expect(props).toHaveLength(1);
  });

  it("REQ-075.3 REQ-075.4 cada métrica sale con la URL sin token ni query", () => {
    const sent = props[0].beforeSend!({ type: "vital", url: "https://x.app/t/abc123?x=1" });
    expect(sent).toEqual({ type: "vital", url: "https://x.app/t/[token]" });
  });
});
