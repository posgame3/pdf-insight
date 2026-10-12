import type { Insight } from '@pdf-insight/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalysisError, requestInsight } from '../api/analyzeClient';
import { buildAnalyzeRequest } from '../lib/buildRequest';
import { checkPdfFile } from '../lib/fileValidation';
import { clearHistory, readHistory, saveToHistory, type HistoryEntry } from '../lib/history';
import { MESSAGES } from '../lib/messages';
import type { ExtractionProgress } from '../lib/pdf/extract';

export type Step = 'reading' | 'analyzing';

export type AnalysisState =
  | { status: 'idle'; notice: string | null }
  | { status: 'working'; fileName: string; step: Step; progress: ExtractionProgress | null; startedAt: number }
  | { status: 'error'; fileName: string; message: string; retryable: boolean }
  | { status: 'empty'; fileName: string }
  | { status: 'done'; insight: Insight; durationMs: number | null };

function describeError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof AnalysisError) return { message: error.message, retryable: error.retryable };
  if (error instanceof Error && error.name === 'PasswordException') {
    return { message: MESSAGES.passwordProtected, retryable: false };
  }
  if (error instanceof Error && error.name === 'InvalidPDFException') {
    return { message: MESSAGES.unreadablePdf, retryable: false };
  }
  return { message: MESSAGES.unexpected, retryable: true };
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle', notice: null });
  const [history, setHistory] = useState<HistoryEntry[]>(readHistory);
  const controller = useRef<AbortController | null>(null);
  const lastFile = useRef<File | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const analyze = useCallback(async (file: File) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    lastFile.current = file;

    const check = await checkPdfFile(file);
    if (!check.ok) {
      setState({ status: 'idle', notice: check.message });
      return;
    }

    const startedAt = performance.now();
    setState({ status: 'working', fileName: file.name, step: 'reading', progress: null, startedAt });
    try {
      const { extractDocument } = await import('../lib/pdf/extract');
      const extracted = await extractDocument(await file.arrayBuffer(), {
        signal: current.signal,
        onProgress: (progress) => {
          setState((previous) => (previous.status === 'working' ? { ...previous, progress } : previous));
        },
      });
      const request = buildAnalyzeRequest(file.name, extracted);
      if (!request) {
        setState({ status: 'empty', fileName: file.name });
        return;
      }
      setState((previous) => (previous.status === 'working' ? { ...previous, step: 'analyzing' } : previous));
      const insight = await requestInsight(request, current.signal);
      setHistory(saveToHistory(insight));
      setState({ status: 'done', insight, durationMs: performance.now() - startedAt });
    } catch (error) {
      if (current.signal.aborted) return;
      setState({ status: 'error', fileName: file.name, ...describeError(error) });
    }
  }, []);

  const selectFiles = useCallback(
    (files: FileList | null) => {
      const [file] = files ?? [];
      if (!file) return;
      if ((files?.length ?? 0) > 1) {
        setState({ status: 'idle', notice: MESSAGES.multipleFiles });
        return;
      }
      void analyze(file);
    },
    [analyze],
  );

  const retry = useCallback(() => {
    if (lastFile.current) void analyze(lastFile.current);
  }, [analyze]);

  const reset = useCallback(() => {
    controller.current?.abort();
    setState({ status: 'idle', notice: null });
  }, []);

  const openHistoryEntry = useCallback((entry: HistoryEntry) => {
    setState({ status: 'done', insight: entry.insight, durationMs: null });
  }, []);

  const removeHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  return { state, history, selectFiles, retry, reset, openHistoryEntry, removeHistory };
}
