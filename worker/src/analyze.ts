import {
  InsightSchema,
  ModelAnalysisSchema,
  ModelOverviewSchema,
  toMatchKey,
  type AnalyzeRequest,
  type Insight,
  type ModelAnalysis,
  type ModelOverview,
} from '@pdf-insight/shared';
import type { z } from 'zod';
import type { CompleteStructured, InputBlock, ModelMessage } from './model/types';
import { planChunks } from './chunking';
import { sortedUnique, uniqueBy } from './collections';
import { AppError } from './errors';
import { textMentionsDate } from './grounding/dates';
import { createEvidenceVerifier } from './grounding/evidence';
import { textMentionsAmount } from './grounding/numbers';
import { logEvent } from './log';
import {
  type AnalysisTask,
  analysisSystemPrompt,
  correctionMessage,
  createBoundary,
  overviewSystemPrompt,
  renderChunk,
  renderOverview,
} from './prompt';
import { toStructuredOutputSchema } from './structuredOutput';
import { extractionWarnings, injectionWarning, unconfirmedWarning, uniqueWarnings } from './warnings';

/** Thinking counts towards max_tokens, so the budget leaves ample room above the JSON itself. */
const ANALYSIS_MAX_TOKENS = 32_000;
const OVERVIEW_MAX_TOKENS = 12_000;
const MAX_ENTITIES = 50;
const MAX_KEYWORDS = 10;

/**
 * Output length, not input, dominates latency: a contract yields dozens of amounts and dates with quotes.
 * Each part of the document is therefore analysed by three parallel calls with narrower schemas, so the
 * wall time is that of the slowest call rather than their sum, and a validation retry repeats only one part.
 */
const ANALYSIS_TASKS = {
  summary: ModelAnalysisSchema.pick({
    document: true,
    summary: true,
    keyPoints: true,
    entities: true,
    keywords: true,
    warnings: true,
  }),
  amounts: ModelAnalysisSchema.pick({ amounts: true }),
  dates: ModelAnalysisSchema.pick({ dates: true }),
} satisfies Record<AnalysisTask, unknown>;

const OUTPUT_SCHEMAS = {
  summary: toStructuredOutputSchema(ANALYSIS_TASKS.summary),
  amounts: toStructuredOutputSchema(ANALYSIS_TASKS.amounts),
  dates: toStructuredOutputSchema(ANALYSIS_TASKS.dates),
  overview: toStructuredOutputSchema(ModelOverviewSchema),
};

export interface AnalyzeDeps {
  complete: CompleteStructured;
  model: string;
  signal: AbortSignal;
  now?: () => Date;
}

interface Prompt {
  system: string;
  content: InputBlock[];
  maxTokens: number;
}

export async function analyzeDocument(request: AnalyzeRequest, deps: AnalyzeDeps): Promise<Insight> {
  const boundary = createBoundary();
  const chunks = planChunks(request);
  const analyses = await Promise.all(
    chunks.map(async (chunk, index): Promise<ModelAnalysis> => {
      const content = renderChunk(
        request.fileName,
        request.pageCount,
        chunk,
        { index, total: chunks.length },
        boundary,
      );
      const prompt = (task: AnalysisTask): Prompt => ({
        system: analysisSystemPrompt(boundary, task),
        content,
        maxTokens: ANALYSIS_MAX_TOKENS,
      });
      const [summary, amounts, dates] = await Promise.all([
        completeValidated(deps, ANALYSIS_TASKS.summary, OUTPUT_SCHEMAS.summary, prompt('summary')),
        completeValidated(deps, ANALYSIS_TASKS.amounts, OUTPUT_SCHEMAS.amounts, prompt('amounts')),
        completeValidated(deps, ANALYSIS_TASKS.dates, OUTPUT_SCHEMAS.dates, prompt('dates')),
      ]);
      return { ...summary, ...amounts, ...dates };
    }),
  );
  const [first] = analyses;
  if (!first) throw new AppError('bad_request');
  const overview =
    analyses.length === 1
      ? first
      : await completeValidated(deps, ModelOverviewSchema, OUTPUT_SCHEMAS.overview, {
          system: overviewSystemPrompt(boundary),
          content: renderOverview(analyses, boundary),
          maxTokens: OVERVIEW_MAX_TOKENS,
        });
  return composeInsight(request, overview, analyses, deps.model, (deps.now ?? (() => new Date()))());
}

type Validation<T> = { success: true; data: T } | { success: false; problems: string[] };

function validate<T>(schema: z.ZodType<T>, json: unknown): Validation<T> {
  if (json === undefined) {
    return { success: false, problems: ['The response was not complete JSON. Return the whole object, concisely.'] };
  }
  const result = schema.safeParse(json);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    problems: result.error.issues.slice(0, 20).map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
}

/**
 * Validation messages are our own fixed texts (paths, limits, counts such as "ma 7"), never document content,
 * so they are safe to log and are what makes a failing model diagnosable.
 */
function invalidFields(problems: readonly string[]): string {
  return problems.join(' | ').slice(0, 500);
}

/** One model call, validated with Zod; on failure exactly one retry that shows the model its validation errors. */
async function completeValidated<T>(
  deps: AnalyzeDeps,
  schema: z.ZodType<T>,
  outputSchema: Record<string, unknown>,
  prompt: Prompt,
): Promise<T> {
  const call = (messages: ModelMessage[]) =>
    deps.complete({
      system: prompt.system,
      messages,
      schema: outputSchema,
      maxTokens: prompt.maxTokens,
      signal: deps.signal,
    });

  const messages: ModelMessage[] = [{ role: 'user', content: prompt.content }];
  const first = await call(messages);
  const firstResult = validate(schema, first.json);
  if (firstResult.success) return firstResult.data;
  logEvent('model_output_invalid', { attempt: 1, fields: invalidFields(firstResult.problems) });

  const second = await call([
    ...messages,
    { role: 'assistant', content: first.content },
    { role: 'user', content: [{ type: 'text', text: correctionMessage(firstResult.problems) }] },
  ]);
  const secondResult = validate(schema, second.json);
  if (secondResult.success) return secondResult.data;
  logEvent('model_output_invalid', { attempt: 2, fields: invalidFields(secondResult.problems) });
  throw new AppError('ai_invalid_response');
}

function uniqueNames(names: readonly string[]): string[] {
  return uniqueBy(names, toMatchKey).slice(0, MAX_ENTITIES);
}

function composeInsight(
  request: AnalyzeRequest,
  overview: ModelOverview,
  analyses: readonly ModelAnalysis[],
  model: string,
  now: Date,
): Insight {
  const verify = createEvidenceVerifier(request.pages, request.extraction.scannedPages);
  const amounts = uniqueBy(
    analyses.flatMap((analysis) => analysis.amounts),
    (amount) => `${amount.value}|${amount.currency}|${toMatchKey(amount.context)}`,
  ).map((amount) => ({ ...amount, ...verify(amount.source, (quote) => textMentionsAmount(quote, amount.value)) }));
  const dates = uniqueBy(
    analyses.flatMap((analysis) => analysis.dates),
    (date) => `${date.date}|${toMatchKey(date.context)}`,
  ).map((date) => ({ ...date, ...verify(date.source, (quote) => textMentionsDate(quote, date.date)) }));

  const modelWarnings = analyses.flatMap((analysis) => analysis.warnings);
  const modelSawInjection = modelWarnings.some((warning) => warning.code === 'prompt_injection');
  const warnings = uniqueWarnings(
    [
      ...extractionWarnings(request.extraction),
      modelSawInjection ? null : injectionWarning(request.pages),
      ...modelWarnings,
      unconfirmedWarning([...amounts, ...dates]),
    ].filter((warning) => warning !== null),
  );

  return InsightSchema.parse({
    document: { fileName: request.fileName, pages: request.pageCount, ...overview.document },
    summary: overview.summary,
    keyPoints: overview.keyPoints,
    entities: {
      organizations: uniqueNames(analyses.flatMap((analysis) => analysis.entities.organizations)),
      people: uniqueNames(analyses.flatMap((analysis) => analysis.entities.people)),
    },
    amounts,
    dates,
    keywords: uniqueBy(overview.keywords, toMatchKey).slice(0, MAX_KEYWORDS),
    analysis: {
      model,
      generatedAt: now.toISOString(),
      pagesAnalyzed: sortedUnique([
        ...request.pages.filter((page) => page.text.trim() !== '').map((page) => page.page),
        ...request.scans.map((scan) => scan.page),
      ]),
      scannedPages: sortedUnique(request.extraction.scannedPages),
      unreadPages: sortedUnique(request.extraction.unreadPages),
      hiddenText: request.extraction.hiddenText,
      warnings,
    },
  } satisfies Insight);
}
