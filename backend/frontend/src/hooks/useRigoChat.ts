import { useCallback, useState } from 'react';
import { apiFetch } from '@/services/api';
import type { BookDoc, ChatMessage, SearchFilters } from '@/types';

function messageTime(): string {
  return new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function toChatFilters(filters?: SearchFilters) {
  if (!filters) return undefined;
  return {
    category: filters.category && filters.category !== 'Todas' ? filters.category : null,
    pasillo: filters.pasillo && filters.pasillo !== 'Todos' ? filters.pasillo : null,
    year_start: filters.yearStart || null,
    year_end: filters.yearEnd || null,
  };
}

/** Splits an SSE byte stream into {event, data} frames, buffering incomplete frames across reads. */
function extractFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  return { frames: parts, rest };
}

function parseFrame(frame: string): { event: string; data: unknown } | null {
  const eventLine = frame.split('\n').find((line) => line.startsWith('event: '));
  const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
  if (!eventLine || !dataLine) return null;
  try {
    return { event: eventLine.slice('event: '.length), data: JSON.parse(dataLine.slice('data: '.length)) };
  } catch {
    return null;
  }
}

export function useRigoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const clear = useCallback(() => setMessages([]), []);

  const sendMessage = useCallback(async (text: string, filters?: SearchFilters): Promise<void> => {
    const question = text.trim();
    if (!question || isStreaming) return;
    const requestId = Date.now();
    const responseId = requestId + 1;
    setMessages((current) => [
      ...current,
      { id: requestId, sender: 'user', text: question, time: messageTime() },
      { id: responseId, sender: 'rigo', text: '', time: messageTime() },
    ]);
    setIsStreaming(true);

    try {
      const res = await apiFetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, filters: toChatFilters(filters) }),
      });
      if (!res.ok || !res.body) throw new Error('El servidor respondió con un error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { frames, rest } = extractFrames(buffer);
        buffer = rest;

        for (const frame of frames) {
          const parsed = parseFrame(frame);
          if (!parsed) continue;

          if (parsed.event === 'metadata') {
            const sources = parsed.data as BookDoc[];
            const first = sources[0];
            setMessages((current) => current.map((message) => message.id === responseId
              ? { ...message, sources, highlightedPasillo: first?.location.pasillo, highlightedEstante: first?.location.estante }
              : message));
          } else if (parsed.event === 'token') {
            const { token } = parsed.data as { token: string };
            setMessages((current) => current.map((message) => message.id === responseId
              ? { ...message, text: message.text + token }
              : message));
          }
        }
      }
    } catch {
      setMessages((current) => current.map((message) => message.id === responseId
        ? { ...message, text: 'No pude conectar con el servidor de RIGO. Intenta de nuevo en unos segundos.' }
        : message));
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming]);

  return { messages, isStreaming, sendMessage, clear };
}
