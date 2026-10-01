import { useCallback, useEffect, useRef, useState } from 'react';

/** The parts of the Web Speech API we use (it is not in the TypeScript DOM typings). */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const getCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings to dictate.',
  'service-not-allowed': 'Voice input is not allowed in this browser.',
  'audio-capture': 'No microphone was found.',
  network: 'Voice input needs an internet connection.',
  'language-not-supported': 'Your language is not supported for voice input.'
};

interface Options {
  /** called with each finished phrase, ready to append to the text */
  onText: (text: string) => void;
  lang?: string;
}

/**
 * Speech-to-text through the browser's own recognition (Chrome, Edge and Safari). `interim` is the phrase being
 * recognised right now, for a live preview. Nothing here is sent to our server.
 */
export function useSpeechRecognition({ onText, lang }: Options) {
  const supported = getCtor() !== null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recognition.current) return;

    const rec = new Ctor();
    rec.lang = lang ?? navigator.language ?? 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) onTextRef.current(result[0].transcript.trim());
        else live += result[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (event) => {
      // "no-speech" and "aborted" just mean silence or a manual stop
      if (event.error !== 'no-speech' && event.error !== 'aborted') setError(ERRORS[event.error] ?? 'Voice input stopped unexpectedly.');
    };
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
      setInterim('');
    };

    setError(null);
    recognition.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setError('Voice input could not start.');
    }
  }, [lang]);

  // Never leave the microphone open when the screen goes away.
  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
