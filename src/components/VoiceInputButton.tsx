import React from 'react';
import { Mic, Square } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VoiceInputButtonProps {
  /** receives each recognised phrase */
  onText: (text: string) => void;
  /** larger, for the quick capture screen */
  large?: boolean;
}

/** Dictate instead of typing. Renders nothing in browsers without speech recognition. */
const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onText, large = false }) => {
  const { supported, listening, interim, error, start, stop } = useSpeechRecognition({ onText });
  if (!supported) return null;

  return (
    <div className={large ? 'flex flex-col items-center gap-2' : 'flex flex-wrap items-center justify-end gap-2'}>
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? 'Stop dictating' : 'Dictate with your voice'}
        className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors ${
          large ? 'h-16 w-16' : 'min-h-11 px-4 text-sm sm:min-h-9'
        } ${listening ? 'bg-danger text-white' : 'bg-accent-soft text-accent-text hover:brightness-95'}`}
      >
        {listening ? <Square className={large ? 'h-6 w-6' : 'h-4 w-4'} aria-hidden /> : <Mic className={large ? 'h-7 w-7' : 'h-4 w-4'} aria-hidden />}
        {!large && (listening ? 'Stop' : 'Dictate')}
        {listening && <span className="h-2 w-2 animate-pulse rounded-full bg-current" aria-hidden />}
      </button>
      <div role="status" className="min-h-5 text-sm text-muted">
        {listening ? (interim ? `…${interim}` : 'Listening…') : null}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
};

export default VoiceInputButton;
