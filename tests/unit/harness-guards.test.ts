import { describe, expect, it } from "vitest";
import {
  checkCommitMessage,
  classifyBash,
  classifyEdit,
  classifyMcp,
  PROD_SUPABASE_PROJECT,
} from "../../.claude/hooks/lib.mjs";

const onBranch = { branch: "claude/harness-agentes" };
const heredocCommit = (msg: string) => `git commit -m "$(cat <<'EOF'\n${msg}\nEOF\n)"`;

describe("Hito 22 · guardias de la terminal (T-250)", () => {
  it("REQ-092.1 bloquea un commit sin prefijo del método", () => {
    const r = classifyBash('git commit -m "arreglo rápido"', onBranch);
    expect(r.decision).toBe("deny");
    expect(r.reason).toMatch(/T-NNN/);
  });

  it("REQ-092.1 deja pasar los prefijos del método", () => {
    for (const msg of [
      "T-250: guardias de la terminal",
      "Hito 22: spec aprobada",
      "Hitos 19 y 20: spec",
      "Spec: el dueño fiel al tablero",
      "Estado: T-195 en producción",
      "Cambio: relectura",
      "Mezcla main en T-195",
      "Guía de prueba de Henry",
      "ADR-066: harness",
    ]) {
      expect(checkCommitMessage(msg).ok, msg).toBe(true);
      expect(classifyBash(`git add a.ts && git commit -m "${msg}"`, onBranch).decision).toBe(
        "allow",
      );
    }
  });

  it("REQ-092.1 lee el mensaje de un heredoc y de -m repetido", () => {
    expect(classifyBash(heredocCommit("T-250: guardias\n\nCuerpo"), onBranch).decision).toBe(
      "allow",
    );
    expect(classifyBash(heredocCommit("wip"), onBranch).decision).toBe("deny");
    expect(classifyBash("git commit -m 'T-250: x' -m 'detalle'", onBranch).decision).toBe("allow");
  });

  it("REQ-092.1 pide confirmación si no puede leer el mensaje", () => {
    expect(classifyBash("git commit -F /tmp/msg.txt", onBranch).decision).toBe("ask");
    expect(classifyBash("git commit", onBranch).decision).toBe("ask");
    expect(classifyBash("git commit --amend --no-edit", onBranch).decision).toBe("allow");
  });

  it("REQ-092.2 bloquea la atribución de IA en commits, PR e issues", () => {
    const withTrailer = heredocCommit(
      "T-250: guardias\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
    );
    expect(classifyBash(withTrailer, onBranch).decision).toBe("deny");
    expect(
      classifyBash(
        `gh pr create --title "T-250" --body "$(cat <<'EOF'\nResumen\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\nEOF\n)"`,
        onBranch,
      ).decision,
    ).toBe("deny");
    expect(
      classifyBash('gh issue comment 3 --body "hecho. Generated with Claude Code"', onBranch)
        .decision,
    ).toBe("deny");
    expect(checkCommitMessage("T-250: x\n\nCo-authored-by: claude <a@b>").ok).toBe(false);
    expect(classifyBash('gh pr create --title "T-250" --body "Resumen"', onBranch).decision).toBe(
      "allow",
    );
  });

  it("REQ-092.3 bloquea el staging de todo el árbol", () => {
    for (const cmd of [
      "git add -A",
      "git add .",
      "git add --all",
      "git add -A src",
      "git -C repo add .",
      "git commit -a -m 'T-250: x'",
      "git commit -am 'T-250: x'",
      "git commit --all -m 'T-250: x'",
      "pnpm lint && git add . && git commit -m 'T-250: x'",
    ]) {
      expect(classifyBash(cmd, onBranch).decision, cmd).toBe("deny");
    }
    expect(classifyBash("git add src/a.ts tests/unit/a.test.ts", onBranch).decision).toBe("allow");
    expect(classifyBash("git add ./src/a.ts", onBranch).decision).toBe("allow");
  });

  it("REQ-092.4 bloquea commit y push estando en main o hacia main", () => {
    expect(classifyBash("git commit -m 'T-250: x'", { branch: "main" }).decision).toBe("deny");
    expect(classifyBash("git push", { branch: "main" }).decision).toBe("deny");
    expect(classifyBash("git push origin main", onBranch).decision).toBe("deny");
    expect(classifyBash("git push origin HEAD:main", onBranch).decision).toBe("deny");
    expect(classifyBash("git push -u origin claude/harness-agentes", onBranch).decision).toBe(
      "allow",
    );
    expect(classifyBash("git status", { branch: "main" }).decision).toBe("allow");
  });

  it("REQ-092.5 bloquea leer secretos por la terminal", () => {
    for (const cmd of [
      "cat .env.local",
      "head -5 .env",
      "grep SUPABASE .env.production",
      "source .env.local && pnpm dev",
      "less ./apps/web/.env",
      "cat supabase/.env",
      "cat key.pem",
      "tail prod.dump",
      "sed -n 1,5p certs/server.key",
      "node -e 'x' < .env.local",
      "cat secrets/token.txt",
    ]) {
      expect(classifyBash(cmd, onBranch).decision, cmd).toBe("deny");
    }
    for (const cmd of ["cat .env.example", "ls -la", "grep -rn env src/lib", "cat package.json"]) {
      expect(classifyBash(cmd, onBranch).decision, cmd).toBe("allow");
    }
  });

  it("REQ-092.6 pide confirmación para lo que toca producción desde la terminal", () => {
    for (const cmd of [
      "supabase db push",
      "supabase migration list --linked",
      "supabase db dump --db-url postgres://u:p@db.example.co:5432/postgres",
      "psql -h db.uucjmxdssnmvznibrafc.supabase.co -U postgres",
      "psql postgresql://postgres:x@aws-0.pooler.supabase.com:6543/postgres -c 'select 1'",
      "vercel --prod",
      "vercel deploy --prod --yes",
      "vercel promote https://turnos-abc.vercel.app",
      "vercel rollback",
    ]) {
      expect(classifyBash(cmd, onBranch).decision, cmd).toBe("ask");
    }
    for (const cmd of [
      "psql -h localhost -U postgres",
      "psql postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      "vercel deploy",
      "supabase start",
    ]) {
      expect(classifyBash(cmd, onBranch).decision, cmd).toBe("allow");
    }
  });

  it("REQ-092.6 la regla que bloquea gana a la que pregunta", () => {
    expect(classifyBash("cat .env.local && vercel --prod", onBranch).decision).toBe("deny");
  });

  it("REQ-092.8 cada bloqueo dice la regla y qué hacer, en español", () => {
    for (const cmd of [
      'git commit -m "wip"',
      "git add -A",
      "cat .env",
      "git push origin main",
      "supabase db push",
    ]) {
      const r = classifyBash(cmd, onBranch);
      expect(r.reason, cmd).toMatch(/^[^\n]+ · [^\n]+$/);
      expect(r.reason, cmd).not.toMatch(/\b(blocked|denied|please)\b/i);
    }
  });
});

describe("Hito 22 · guardias de edición y MCP (T-251)", () => {
  const inMain = (p: string) => p === "supabase/migrations/0074_brand_images.sql";

  it("REQ-092.7 bloquea editar una migración que ya está en main", () => {
    const r = classifyEdit("supabase/migrations/0074_brand_images.sql", { existsInMain: inMain });
    expect(r.decision).toBe("deny");
    expect(r.reason).toMatch(/ · /);
  });

  it("REQ-092.7 deja crear una migración nueva y editar el resto", () => {
    expect(
      classifyEdit("supabase/migrations/0076_nueva.sql", { existsInMain: inMain }).decision,
    ).toBe("allow");
    expect(classifyEdit("supabase/tests/0074.sql", { existsInMain: () => true }).decision).toBe(
      "allow",
    );
    expect(classifyEdit("src/app/page.tsx", { existsInMain: () => true }).decision).toBe("allow");
  });

  it("REQ-092.6 pide confirmación para MCP de Supabase que escribe en producción", () => {
    const sb = "mcp__5db91adc-0429-4eeb-b5b4-26833572548e__";
    expect(
      classifyMcp(`${sb}execute_sql`, { project_id: PROD_SUPABASE_PROJECT, query: "select 1" })
        .decision,
    ).toBe("ask");
    expect(
      classifyMcp(`${sb}apply_migration`, { project_id: PROD_SUPABASE_PROJECT }).decision,
    ).toBe("ask");
    expect(classifyMcp(`${sb}apply_migration`, {}).decision).toBe("ask");
    expect(classifyMcp(`${sb}merge_branch`, { branch_id: "b1" }).decision).toBe("ask");
    expect(classifyMcp(`${sb}execute_sql`, { project_id: "otro-branch" }).decision).toBe("allow");
    expect(classifyMcp(`${sb}list_tables`, { project_id: PROD_SUPABASE_PROJECT }).decision).toBe(
      "allow",
    );
  });

  it("REQ-092.6 pide confirmación para promover o desplegar a producción en Vercel por MCP", () => {
    const v = "mcp__04c5bd65-be9b-4e36-b52a-a06c97512f56__";
    expect(classifyMcp(`${v}request_promote`, {}).decision).toBe("ask");
    expect(classifyMcp(`${v}request_rollback`, {}).decision).toBe("ask");
    expect(classifyMcp(`${v}create_deployment`, { target: "production" }).decision).toBe("ask");
    expect(classifyMcp(`${v}create_deployment`, { target: "preview" }).decision).toBe("allow");
    expect(classifyMcp(`${v}list_deployments`, {}).decision).toBe("allow");
  });
});
