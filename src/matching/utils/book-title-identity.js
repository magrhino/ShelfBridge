import { normalizeTitle } from './text-matching.js';

const AUDIOBOOK_ANNOTATION_PATTERN =
  /\s*[[(]\s*(?:abridged|audio\s+drama|audio\s+edition|audiobook|dramatized\s+adaptation|full\s+cast(?:\s+production)?|graphic\s*audio|unabridged)\s*[\])]/gi;

const WORK_NUMBER_PATTERN =
  /\b(act|book|bk\.?|part|pt\.?|volume|vol\.?)\s*(\d+|[ivx]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi;

const COLLECTION_SIZE_PATTERN =
  /\b(\d+|two|three|four|five|six|seven|eight|nine)\s+books?\b/i;

export const COLLECTION_TITLE_PATTERN =
  /\b(?:box(?:ed)?\s+set|collection(?:\s+set)?|omnibus|bundle|(?:two|three|four|five|six|seven|eight|nine|\d+)\s+books?)\b/i;

export function stripAudiobookAnnotations(title) {
  return String(title || '')
    .replace(AUDIOBOOK_ANNOTATION_PATTERN, ' ')
    .trim();
}

export function normalizeIdentityTitle(title) {
  return normalizeTitle(stripAudiobookAnnotations(title));
}

export function normalizeWorkTitle(title) {
  const withoutAnnotations = stripAudiobookAnnotations(title);
  return normalizeTitle(withoutAnnotations.split(/[:–—]/, 1)[0]);
}

// Canonical title search also accepts hyphen-delimited edition subtitles.
// Identifier validation keeps hyphens as part of the work identity.
export function normalizeCanonicalWorkTitle(title) {
  return normalizeTitle(stripAudiobookAnnotations(title).split(/[-:–—]/, 1)[0]);
}

export function getWorkNumberMarkers(title) {
  return [...String(title || '').matchAll(WORK_NUMBER_PATTERN)]
    .map(([, type, number]) => {
      const normalizedType = {
        bk: 'book',
        pt: 'part',
        vol: 'volume',
      }[type.toLowerCase().replace('.', '')];

      return `${normalizedType || type.toLowerCase()}:${normalizeTitle(number)}`;
    })
    .sort();
}

export function getCollectionSize(title) {
  const match = String(title || '').match(COLLECTION_SIZE_PATTERN);
  return match ? normalizeTitle(match[1]) : null;
}

export function isCollectionTitle(title) {
  return COLLECTION_TITLE_PATTERN.test(String(title || ''));
}

const SAFE_CANONICAL_SUFFIX_PATTERN =
  /(?:\b(?:anniversary|special|revised|updated|expanded)\s+edition\b|\b(?:archive|chronicles|cycle|prequel|quartet|saga|series|trilogy)\b|^(?:a|an)\s+.+\b(?:adventure|novel|story)\b)/i;
const SPLIT_AUDIO_PART_PATTERN = /[[(]\s*\d+\s+of\s+\d+\s*[\])]/i;
const AUDIOBOOK_ANNOTATION_TEST_PATTERN =
  /[[(]\s*(?:abridged|audio\s+drama|audio\s+edition|audiobook|dramatized\s+adaptation|full\s+cast(?:\s+production)?|graphic\s*audio|unabridged)\s*[\])]/i;
const EXPLICIT_WORK_PART_PATTERN =
  /(?:\b(?:vol(?:ume)?|bk|book|pt|part)\b\.?\s*|#\s*)([a-z]+|\d+(?:\.\d+)?)/i;

function extractExplicitWorkPartNumber(title) {
  const value = String(title || '').match(EXPLICIT_WORK_PART_PATTERN)?.[1];
  if (!value) return null;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);

  const normalized = normalizeTitle(value);
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

export function hasConflictingExplicitWorkParts(sourceTitle, candidateTitle) {
  const sourcePart = extractExplicitWorkPartNumber(sourceTitle);
  const candidatePart = extractExplicitWorkPartNumber(candidateTitle);
  return (
    sourcePart !== null &&
    candidatePart !== null &&
    sourcePart !== candidatePart
  );
}

export function isCanonicalTitleReductionSafe(title) {
  const rawTitle = String(title || '');
  const separatorIndex = rawTitle.search(/[-:–—]/);
  if (separatorIndex < 0) return true;

  const prefix = rawTitle.slice(0, separatorIndex);
  const suffix = rawTitle.slice(separatorIndex + 1).trim();
  if (!suffix) return false;

  return (
    AUDIOBOOK_ANNOTATION_TEST_PATTERN.test(prefix) ||
    SPLIT_AUDIO_PART_PATTERN.test(prefix) ||
    SAFE_CANONICAL_SUFFIX_PATTERN.test(suffix)
  );
}
