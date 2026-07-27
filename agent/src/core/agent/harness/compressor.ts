import { Observation } from '../../../../../shared/types';

export function compressObservation(
  obs: Observation,
  failures: number,
  maxRetries: number,
  isOpen: boolean
): Observation {
  const raw = (obs.summary || '').trim();
  let summary: string;

  if (failures >= 3 && isOpen) {
    summary = '';
  } else {
    const sentence = raw.match(/^[^.!?]+[.!?]/)?.[0]?.trim() || raw;
    summary = isOpen ? `${sentence} (circuit open)` : sentence ? `${sentence} (retry ${failures}/${maxRetries})` : `(retry ${failures}/${maxRetries})`;
  }

  return { status: obs.status, summary };
}
