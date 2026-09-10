import type { BookDoc, ChatMessage } from '@/types';
import { BookCard } from '@/components/kiosk/BookCard';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  onViewLocation?: (book: BookDoc) => void;
  onViewPdf?: (book: BookDoc) => void;
}

export function ChatMessageList({ messages, isStreaming, onViewLocation, onViewPdf }: ChatMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-slate-500 dark:text-slate-400">
        <span className="text-4xl">📚</span>
        <p className="max-w-md text-sm">
          Pregunta por los fondos bibliográficos de la UNA Piura. Incluyo la ficha, la ubicación en pasillo y el
          croquis 2D.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {messages.map((msg) =>
        msg.sender === 'rigo' ? (
          <div key={msg.id} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
<img src="/rigo-logo.svg" alt="RIGO" className="mt-1 h-7 w-7 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-2.5 ring-1 ring-inset ring-slate-200 transition-colors duration-300 dark:bg-slate-900 dark:ring-slate-800">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">{msg.text}</p>
                  {msg.excerpt ? <p className="mt-2 rounded bg-slate-100 px-3 py-2 text-xs italic text-slate-500 dark:bg-slate-950 dark:text-slate-400">{msg.excerpt}</p> : null}
                </div>
              </div>
            </div>

            {msg.sources && msg.sources.length > 0 ? (
              <div className="grid gap-3 pl-10 sm:grid-cols-2">
                {msg.sources.map((book) => (
                  <BookCard key={book.id} book={book} onViewLocation={onViewLocation} onViewPdf={onViewPdf} />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950">
              {msg.text}
              <span className="ml-2 text-[10px] font-normal opacity-60">{msg.time}</span>
            </div>
          </div>
        ),
      )}

      {isStreaming ? (
        <div className="flex items-center gap-2 pl-10 text-sm text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          RIGO está escribiendo…
        </div>
      ) : null}
    </div>
  );
}
