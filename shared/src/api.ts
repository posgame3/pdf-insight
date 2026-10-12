import { z } from 'zod';
import { LIMITS } from './limits';
import { hiddenTextSchema, pageNumberSchema } from './schema';

export const SCAN_MEDIA_TYPES = ['image/jpeg', 'image/png'] as const;

const pageTextSchema = z.object({
  page: pageNumberSchema,
  text: z.string().max(LIMITS.maxPageChars),
});

const scanSchema = z.object({
  page: pageNumberSchema,
  mediaType: z.enum(SCAN_MEDIA_TYPES),
  data: z
    .string()
    .min(1)
    .max(LIMITS.maxScanImageChars)
    .refine((data) => data.length % 4 === 0, 'Obraz musi być zakodowany w base64'),
});

export const ExtractionReportSchema = z.object({
  scannedPages: z.array(pageNumberSchema).max(LIMITS.maxPages),
  unreadPages: z.array(pageNumberSchema).max(10_000),
  hiddenText: z.array(hiddenTextSchema).max(LIMITS.maxPages),
});

export const AnalyzeRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    pageCount: z.number().int().min(1).max(10_000),
    pages: z.array(pageTextSchema).max(LIMITS.maxPages),
    scans: z.array(scanSchema).max(LIMITS.maxScanImages),
    extraction: ExtractionReportSchema,
  })
  .superRefine((request, context) => {
    const pageNumbers = [...request.pages, ...request.scans].map((item) => item.page);
    if (pageNumbers.some((page) => page > request.pageCount)) {
      context.addIssue({ code: 'custom', message: 'Numer strony przekracza liczbę stron dokumentu' });
    }
    if (new Set(request.pages.map((item) => item.page)).size !== request.pages.length) {
      context.addIssue({ code: 'custom', message: 'Strony nie mogą się powtarzać' });
    }
    const totalChars = request.pages.reduce((sum, item) => sum + item.text.length, 0);
    if (totalChars > LIMITS.maxTotalChars) {
      context.addIssue({ code: 'custom', message: 'Dokument zawiera za dużo tekstu' });
    }
    const hasContent = request.pages.some((item) => item.text.trim() !== '') || request.scans.length > 0;
    if (!hasContent) {
      context.addIssue({ code: 'custom', message: 'Dokument nie zawiera tekstu ani skanów do analizy' });
    }
  });

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type ExtractionReport = z.infer<typeof ExtractionReportSchema>;
export type PageText = z.infer<typeof pageTextSchema>;
export type Scan = z.infer<typeof scanSchema>;

export const API_ERROR_MESSAGES = {
  bad_request: 'Serwer odrzucił dane dokumentu. Spróbuj ponownie z innym plikiem.',
  forbidden_origin: 'Ta strona nie ma dostępu do usługi analizy.',
  not_found: 'Nieznany adres usługi.',
  method_not_allowed: 'Niedozwolona metoda zapytania.',
  payload_too_large: 'Dokument jest za duży do analizy.',
  unsupported_media_type: 'Nieobsługiwany format zapytania.',
  rate_limited: 'Za dużo analiz w krótkim czasie. Odczekaj minutę i spróbuj ponownie.',
  ai_invalid_response: 'Model AI dwukrotnie zwrócił niepoprawną odpowiedź. Spróbuj ponownie.',
  ai_unavailable: 'Usługa AI jest chwilowo niedostępna lub przeciążona. Spróbuj ponownie za chwilę.',
  timeout: 'Analiza trwała zbyt długo i została przerwana. Spróbuj ponownie lub wybierz krótszy dokument.',
  internal: 'Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie.',
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_MESSAGES;
export const API_ERROR_CODES = Object.keys(API_ERROR_MESSAGES) as [ApiErrorCode, ...ApiErrorCode[]];

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
