export type DiagnosticContextValue = string | number | boolean | null | undefined;

export type DiagnosticContext = Record<string, DiagnosticContextValue>;

export interface MobileDiagnosticEntry {
  id: number;
  source: "api" | "client";
  route: string;
  method: string | null;
  status: number | null;
  code: string;
  message: string;
  requestId: string | null;
  timestamp: string;
  context: DiagnosticContext;
}

interface DiagnosticMatch {
  route: string;
  requestId?: string | null;
  status?: number | null;
  code?: string;
}

interface DiagnosticSeed {
  source: "api" | "client";
  route: string;
  method?: string | null;
  status?: number | null;
  code: string;
  message?: string;
  requestId?: string | null;
  context?: DiagnosticContext;
}

const DIAGNOSTIC_BUFFER_LIMIT = 50;

let nextDiagnosticId = 1;
const diagnosticsBuffer: MobileDiagnosticEntry[] = [];

function normalizeContext(context?: DiagnosticContext): DiagnosticContext {
  if (!context) return {};
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined)
  );
}

function pushDiagnostic(seed: DiagnosticSeed): MobileDiagnosticEntry {
  const entry: MobileDiagnosticEntry = {
    id: nextDiagnosticId,
    source: seed.source,
    route: seed.route,
    method: seed.method ?? null,
    status: seed.status ?? null,
    code: seed.code,
    message: seed.message ?? "",
    requestId: seed.requestId ?? null,
    timestamp: new Date().toISOString(),
    context: normalizeContext(seed.context),
  };
  nextDiagnosticId += 1;
  diagnosticsBuffer.push(entry);
  if (diagnosticsBuffer.length > DIAGNOSTIC_BUFFER_LIMIT) {
    diagnosticsBuffer.splice(0, diagnosticsBuffer.length - DIAGNOSTIC_BUFFER_LIMIT);
  }
  return entry;
}

function findLatestDiagnostic(match: DiagnosticMatch): MobileDiagnosticEntry | null {
  for (let index = diagnosticsBuffer.length - 1; index >= 0; index -= 1) {
    const candidate = diagnosticsBuffer[index];
    if (candidate.route !== match.route) continue;
    if (match.requestId !== undefined && candidate.requestId !== (match.requestId ?? null)) continue;
    if (match.status !== undefined && candidate.status !== (match.status ?? null)) continue;
    if (match.code !== undefined && candidate.code !== match.code) continue;
    return candidate;
  }
  return null;
}

export function recordApiFailure(seed: {
  route: string;
  method: string;
  status: number;
  code: string;
  message: string;
  requestId: string | null;
}): MobileDiagnosticEntry {
  return pushDiagnostic({
    source: "api",
    route: seed.route,
    method: seed.method,
    status: seed.status,
    code: seed.code,
    message: seed.message,
    requestId: seed.requestId,
  });
}

export function recordClientDiagnostic(seed: {
  route: string;
  status?: number | null;
  code: string;
  message?: string;
  requestId?: string | null;
  context?: DiagnosticContext;
}): MobileDiagnosticEntry {
  return pushDiagnostic({
    source: "client",
    route: seed.route,
    status: seed.status,
    code: seed.code,
    message: seed.message,
    requestId: seed.requestId,
    context: seed.context,
  });
}

export function enrichFailureDiagnostic(
  match: DiagnosticMatch,
  context: DiagnosticContext,
  fallback?: Omit<DiagnosticSeed, "source" | "context"> & { source?: "api" | "client" }
): MobileDiagnosticEntry {
  const existing = findLatestDiagnostic(match);
  if (existing) {
    existing.context = {
      ...existing.context,
      ...normalizeContext(context),
    };
    return existing;
  }

  return pushDiagnostic({
    source: fallback?.source ?? "client",
    route: fallback?.route ?? match.route,
    method: fallback?.method ?? null,
    status: fallback?.status ?? match.status ?? null,
    code: fallback?.code ?? match.code ?? "UNANNOTATED_FAILURE",
    message: fallback?.message ?? "",
    requestId: fallback?.requestId ?? match.requestId ?? null,
    context,
  });
}

export function getRecentDiagnostics(): MobileDiagnosticEntry[] {
  return diagnosticsBuffer.map((entry) => ({
    ...entry,
    context: { ...entry.context },
  }));
}

export function clearDiagnostics(): void {
  diagnosticsBuffer.length = 0;
}
