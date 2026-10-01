import { ReportReason } from '../types';

/** Reasons a person can pick when reporting; the same labels are shown to moderators. */
export const REPORT_REASONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: 'spam', label: 'Spam or advertising', hint: 'Unwanted promotion or repeated posts' },
  { value: 'harassment', label: 'Harassment or bullying', hint: 'Targets or attacks a person' },
  { value: 'hate', label: 'Hate speech', hint: 'Attacks people for who they are' },
  { value: 'sexual', label: 'Sexual or graphic content', hint: 'Explicit or disturbing material' },
  { value: 'violence', label: 'Violence or threats', hint: 'Threatens or encourages harm' },
  { value: 'self_harm', label: 'Self-harm', hint: 'Someone may be at risk' },
  { value: 'other', label: 'Something else', hint: 'Tell us more below' }
];

export const reasonLabel = (reason: ReportReason): string =>
  REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
