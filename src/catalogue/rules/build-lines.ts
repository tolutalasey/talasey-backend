export interface BuildPart {
  variant_id: string;
  quantity: number;
  side?: string;
}

export interface BuildLine {
  variant_id: string;
  quantity: number;
  metadata: {
    build_id: string;
    build_parts: { quantity: number; side?: string }[];
  };
}

// One line per SKU in the build. Parts with the same SKU are combined, and where each one goes is
// kept in metadata so the order still shows the per-side detail.
export function buildLines(buildId: string, parts: BuildPart[]): BuildLine[] {
  const lines = new Map<string, BuildLine>();
  for (const part of parts) {
    const line = lines.get(part.variant_id) ?? {
      variant_id: part.variant_id,
      quantity: 0,
      metadata: { build_id: buildId, build_parts: [] },
    };
    line.quantity += part.quantity;
    line.metadata.build_parts.push({
      quantity: part.quantity,
      ...(part.side && { side: part.side }),
    });
    lines.set(part.variant_id, line);
  }
  return [...lines.values()];
}
