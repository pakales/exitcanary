import { z } from "zod";

export const MAX_MODEL_MAPPINGS = 160;
export const MAX_MODEL_UNRESOLVED = 160;

const boundedPath = z.string().min(1).max(360);
const boundedName = z.string().min(1).max(160);
const canonicalName = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/);
const verdictLanguage =
  /\b(?:exit[\s_-]*ready|not[\s_-]*exit[\s_-]*ready|needs[\s_-]*review|(?:ready|safe|unsafe)[\s_-]*(?:to[\s_-]*)?(?:leave|exit)|(?:this|the|your|our)?[\s_-]*(?:export|packet|data(?:set)?|migration|workspace|account|system)[\s_-]*(?:is|isn't|is[\s_-]*not|looks|appears|seems|remains)[\s_-]*(?:not[\s_-]*)?(?:ready|safe|unsafe))\b/i;

function boundedModelExplanation(maximumLength: number) {
  return z
    .string()
    .min(1)
    .max(maximumLength)
    .refine((value) => !verdictLanguage.test(value), {
      message: "Mapping prose contains reserved exit-readiness verdict language.",
    });
}

export const SourceEvidenceFieldSchema = z
  .object({
    sourceFile: boundedPath,
    sourceField: boundedName,
    evidencePath: boundedPath,
    sampleValues: z.array(z.string().max(320)).max(5),
  })
  .strict();

export type SourceEvidenceField = z.infer<typeof SourceEvidenceFieldSchema>;

export const CanonicalMappingTargetSchema = z
  .object({
    canonicalEntity: canonicalName,
    canonicalField: canonicalName,
    aliases: z.array(boundedName).min(1).max(16),
    required: z.boolean(),
  })
  .strict();

export type CanonicalMappingTarget = z.infer<
  typeof CanonicalMappingTargetSchema
>;

export const ModelMappingBasisSchema = z.enum([
  "header_semantics",
  "sample_value_semantics",
  "combined_evidence",
]);

const ModelProposedFieldMappingSchema = z
  .object({
    sourceFile: boundedPath,
    sourceField: boundedName,
    canonicalEntity: canonicalName,
    canonicalField: canonicalName,
    evidencePaths: z.array(boundedPath).min(1).max(3),
    confidence: z.number().min(0).max(1),
    basis: ModelMappingBasisSchema,
  })
  .strict();

export const ProposedFieldMappingSchema = z
  .object({
    sourceFile: boundedPath,
    sourceField: boundedName,
    canonicalEntity: canonicalName,
    canonicalField: canonicalName,
    evidencePaths: z.array(boundedPath).min(1).max(3),
    confidence: z.number().min(0).max(1),
    rationale: boundedModelExplanation(240),
  })
  .strict();

export const UnresolvedFieldMappingSchema = z
  .object({
    canonicalEntity: canonicalName,
    canonicalField: canonicalName,
    reason: z.enum(["not_found", "ambiguous", "unsupported"]),
    candidateEvidencePaths: z.array(boundedPath).max(6),
  })
  .strict();

/**
 * Exact GPT structured-output contract. It deliberately contains no free-form
 * rationale or summary field, so model-authored prose cannot cross the mapper
 * boundary or resemble an authoritative exit-readiness decision.
 */
export const ModelSemanticMappingProposalSchema = z
  .object({
    proposedMapping: z
      .array(ModelProposedFieldMappingSchema)
      .max(MAX_MODEL_MAPPINGS),
    unresolved: z
      .array(UnresolvedFieldMappingSchema)
      .max(MAX_MODEL_UNRESOLVED),
  })
  .strict();

export type ModelSemanticMappingProposal = z.infer<
  typeof ModelSemanticMappingProposalSchema
>;

export const SemanticMappingProposalSchema = z
  .object({
    proposedMapping: z
      .array(ProposedFieldMappingSchema)
      .max(MAX_MODEL_MAPPINGS),
    unresolved: z
      .array(UnresolvedFieldMappingSchema)
      .max(MAX_MODEL_UNRESOLVED),
    summary: boundedModelExplanation(600),
  })
  .strict();

export type SemanticMappingProposal = z.infer<
  typeof SemanticMappingProposalSchema
>;

export const MappingFallbackReasonSchema = z.enum([
  "missing_api_key",
  "live_mapping_disabled",
  "model_refusal",
  "model_timeout",
  "invalid_model_output",
  "provider_error",
]);

export type MappingFallbackReason = z.infer<
  typeof MappingFallbackReasonSchema
>;

const LiveSemanticMappingResponseSchema = SemanticMappingProposalSchema.extend({
  mode: z.literal("live"),
  model: z.literal("gpt-5.6-sol"),
}).strict();

const FallbackSemanticMappingResponseSchema =
  SemanticMappingProposalSchema.extend({
    mode: z.literal("fallback"),
    model: z.null(),
    warning: z.string().min(1).max(320),
  }).strict();

export const SemanticMappingResponseSchema = z.discriminatedUnion("mode", [
  LiveSemanticMappingResponseSchema,
  FallbackSemanticMappingResponseSchema,
]);

export type SemanticMappingResponse = z.infer<
  typeof SemanticMappingResponseSchema
>;

function canonicalKey(
  value: Pick<CanonicalMappingTarget, "canonicalEntity" | "canonicalField">,
): string {
  return `${value.canonicalEntity}.${value.canonicalField}`;
}

function sourceKey(
  value: Pick<SourceEvidenceField, "sourceFile" | "sourceField">,
): string {
  return `${value.sourceFile}\u0000${value.sourceField}`;
}

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function buildDeterministicHeaderFallback(
  sources: readonly SourceEvidenceField[],
  targets: readonly CanonicalMappingTarget[],
): SemanticMappingProposal {
  const candidatesByTarget = new Map<string, SourceEvidenceField[]>();
  const targetKeysBySource = new Map<string, string[]>();

  for (const target of targets) {
    const targetKey = canonicalKey(target);
    const acceptedHeaders = new Set(
      [target.canonicalField, ...target.aliases]
        .map(normalizeHeader)
        .filter(Boolean),
    );
    const candidates = sources.filter((source) =>
      acceptedHeaders.has(normalizeHeader(source.sourceField)),
    );
    candidatesByTarget.set(targetKey, candidates);

    for (const source of candidates) {
      const key = sourceKey(source);
      targetKeysBySource.set(key, [
        ...(targetKeysBySource.get(key) ?? []),
        targetKey,
      ]);
    }
  }

  const proposedMapping: SemanticMappingProposal["proposedMapping"] = [];
  const unresolved: SemanticMappingProposal["unresolved"] = [];

  for (const target of targets) {
    const targetKey = canonicalKey(target);
    const candidates = candidatesByTarget.get(targetKey) ?? [];
    const unambiguous = candidates.filter(
      (source) => (targetKeysBySource.get(sourceKey(source)) ?? []).length === 1,
    );

    if (candidates.length === 1 && unambiguous.length === 1) {
      const source = unambiguous[0];
      proposedMapping.push({
        sourceFile: source.sourceFile,
        sourceField: source.sourceField,
        canonicalEntity: target.canonicalEntity,
        canonicalField: target.canonicalField,
        evidencePaths: [source.evidencePath],
        confidence:
          normalizeHeader(source.sourceField) ===
          normalizeHeader(target.canonicalField)
            ? 1
            : 0.98,
        rationale: "Exact normalized header match.",
      });
      continue;
    }

    unresolved.push({
      canonicalEntity: target.canonicalEntity,
      canonicalField: target.canonicalField,
      reason: candidates.length === 0 ? "not_found" : "ambiguous",
      candidateEvidencePaths: candidates
        .map((candidate) => candidate.evidencePath)
        .slice(0, 6),
    });
  }

  return {
    proposedMapping,
    unresolved,
    summary:
      unresolved.length === 0
        ? "Deterministic header matching proposed every canonical field. Human confirmation is still required."
        : `Deterministic header matching proposed ${proposedMapping.length} field${
            proposedMapping.length === 1 ? "" : "s"
          } and left ${unresolved.length} unresolved.`,
  };
}

export function validateProposalAgainstEvidence(
  proposal: unknown,
  sources: readonly SourceEvidenceField[],
  targets: readonly CanonicalMappingTarget[],
): SemanticMappingProposal | null {
  const parsed = ModelSemanticMappingProposalSchema.safeParse(proposal);
  if (!parsed.success) return null;

  const sourcesByKey = new Map(
    sources.map((source) => [sourceKey(source), source] as const),
  );
  const targetsByKey = new Map(
    targets.map((target) => [canonicalKey(target), target] as const),
  );
  const representedTargets = new Set<string>();
  const representedSources = new Set<string>();

  for (const mapping of parsed.data.proposedMapping) {
    const mappedSourceKey = sourceKey(mapping);
    const mappedTargetKey = canonicalKey(mapping);
    const source = sourcesByKey.get(mappedSourceKey);

    if (!source || !targetsByKey.has(mappedTargetKey)) return null;
    if (
      representedSources.has(mappedSourceKey) ||
      representedTargets.has(mappedTargetKey)
    ) {
      return null;
    }
    if (
      mapping.evidencePaths.some(
        (evidencePath) => evidencePath !== source.evidencePath,
      )
    ) {
      return null;
    }

    representedSources.add(mappedSourceKey);
    representedTargets.add(mappedTargetKey);
  }

  const allowedEvidencePaths = new Set(
    sources.map((source) => source.evidencePath),
  );
  for (const item of parsed.data.unresolved) {
    const targetKey = canonicalKey(item);
    if (
      !targetsByKey.has(targetKey) ||
      representedTargets.has(targetKey) ||
      item.candidateEvidencePaths.some(
        (evidencePath) => !allowedEvidencePaths.has(evidencePath),
      )
    ) {
      return null;
    }
    representedTargets.add(targetKey);
  }

  if (representedTargets.size !== targetsByKey.size) return null;

  const rationaleByBasis: Record<
    z.infer<typeof ModelMappingBasisSchema>,
    string
  > = {
    header_semantics:
      "GPT-5.6 matched the supplied field name to this canonical target; human confirmation is required.",
    sample_value_semantics:
      "GPT-5.6 matched bounded supplied sample values to this canonical target; human confirmation is required.",
    combined_evidence:
      "GPT-5.6 matched the supplied field name and bounded samples to this canonical target; human confirmation is required.",
  };
  const proposedCount = parsed.data.proposedMapping.length;
  const unresolvedCount = parsed.data.unresolved.length;

  return SemanticMappingProposalSchema.parse({
    proposedMapping: parsed.data.proposedMapping.map(
      ({ basis, ...mapping }) => ({
        ...mapping,
        rationale: rationaleByBasis[basis],
      }),
    ),
    unresolved: parsed.data.unresolved,
    summary:
      unresolvedCount === 0
        ? `GPT-5.6 proposed all ${proposedCount} canonical field mappings from supplied evidence. Human confirmation is still required.`
        : `GPT-5.6 proposed ${proposedCount} canonical field mapping${proposedCount === 1 ? "" : "s"} and left ${unresolvedCount} unresolved. Human confirmation is required.`,
  });
}
