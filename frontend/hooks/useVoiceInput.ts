/**
 * Browser Web Speech API hook. Live transcript is appended to a controlled value.
 * Returns { transcript, isListening, start, stop, supported, error }.
 *
 * `supported` is false on Firefox/Safari (and any non-Chromium browser without
 * the SpeechRecognition API). Callers should fall back to manual paste.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Type shims — the Web Speech API is not in lib.dom by default.
type SR = any;

declare global {
  interface Window {
    SpeechRecognition?: SR;
    webkitSpeechRecognition?: SR;
  }
}

function getSRClass(): SR | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const recogRef = useRef<any>(null);

  useEffect(() => {
    setSupported(getSRClass() !== null);
  }, []);

  const start = useCallback(() => {
    const SR = getSRClass();
    if (!SR) {
      setError("Voice input is not supported in this browser. Please type or paste instead.");
      return;
    }
    setError(null);
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    let finalText = "";
    recog.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setTranscript((finalText + interim).trim());
    };
    recog.onerror = (e: any) => setError(`Voice error: ${e.error}`);
    recog.onend = () => setIsListening(false);

    try {
      recog.start();
      recogRef.current = recog;
      setIsListening(true);
    } catch (e: any) {
      setError(`Could not start voice input: ${e?.message || e}`);
    }
  }, []);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  return { transcript, isListening, start, stop, reset, supported, error };
}