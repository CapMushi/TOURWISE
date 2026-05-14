import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { MessageCircle, X, Send, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { streamChatbot } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";

/** Renders a run of text, converting **bold** and *italic* markers to JSX. */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[0].startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
    } else {
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Converts a settled assistant message string into readable JSX with markdown. */
function renderMessage(content: string): React.ReactNode {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let nodeKey = 0;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    nodes.push(
      <ul key={nodeKey++} className="mt-1 mb-1 space-y-0.5 pl-3">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex gap-1.5 text-sm">
            <span className="mt-0.5 shrink-0 text-primary">•</span>
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,2}\s/.test(line)) {
      flushBullets();
      const text = line.replace(/^#{1,2}\s/, "").trim();
      nodes.push(
        <p key={nodeKey++} className="mt-2 mb-0.5 text-sm font-bold uppercase tracking-wide text-heading">
          {text}
        </p>
      );
      continue;
    }
    if (/^[-*]\s/.test(line)) {
      bulletBuffer.push(line.replace(/^[-*]\s/, ""));
      continue;
    }
    flushBullets();
    if (line === "") {
      nodes.push(<div key={nodeKey++} className="h-1.5" />);
    } else {
      nodes.push(
        <p key={nodeKey++} className="text-sm leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushBullets();
  return <div className="space-y-0.5">{nodes}</div>;
}

// ---------------------------------------------------------------------------
// Word interval — how long each word is displayed before the next one fades in
// ---------------------------------------------------------------------------
const WORD_MS = 38;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  animatingWord?: string; // the one word currently fading in (undefined = settled)
  wordKey?: number;       // increments per word to retrigger the CSS animation
  sources?: Array<{ title?: string; similarity?: number }>;
};

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [size, setSize] = useState({ width: 384, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeOrigin = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // --- resize logic ---
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeOrigin.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!resizeOrigin.current) return;
      const dx = resizeOrigin.current.startX - e.clientX;
      const dy = resizeOrigin.current.startY - e.clientY;
      setSize({
        width: Math.max(280, Math.min(680, resizeOrigin.current.startW + dx)),
        height: Math.max(300, Math.min(window.innerHeight - 120, resizeOrigin.current.startH + dy)),
      });
    };
    const onMouseUp = () => { resizeOrigin.current = null; setIsResizing(false); };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing]);

  // --- chat state ---
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! I'm your TourWise assistant. I can help with trips, bookings, agents, and general platform questions.",
    },
  ]);

  // Personalise the opening greeting with the user's name once on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      const meta = session.user.user_metadata ?? {};
      const name: string =
        meta.username ||
        meta.full_name ||
        meta.name ||
        session.user.email?.split("@")[0] ||
        "";
      if (!name) return;
      const firstName = name.split(" ")[0];
      setMessages([
        {
          role: "assistant",
          content: `Hi ${firstName}! I'm your TourWise assistant. I can help with trips, bookings, agents, and general platform questions.`,
        },
      ]);
    });
  }, []);
  const [isPending, setIsPending] = useState(false);

  // --- word queue refs ---
  const wordQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const pendingSourcesRef = useRef<Array<{ title?: string; similarity?: number }> | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Ref holding the self-recursive word-processor so setTimeout always calls the latest version
  const processNextWordRef = useRef<() => void>(() => {});
  processNextWordRef.current = () => {
    if (!mountedRef.current) return;

    if (wordQueueRef.current.length === 0) {
      isProcessingRef.current = false;
      // Queue drained: commit final animating word + apply pending sources
      const pending = pendingSourcesRef.current;
      pendingSourcesRef.current = null;
      flushSync(() => {
        setMessages((prev) => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          if (last.role !== "assistant") return msgs;
          return [
            ...msgs.slice(0, -1),
            {
              ...last,
              content:
                last.animatingWord !== undefined
                  ? last.content + last.animatingWord
                  : last.content,
              animatingWord: undefined,
              wordKey: undefined,
              ...(pending !== null ? { sources: pending } : {}),
            },
          ];
        });
      });
      return;
    }

    const word = wordQueueRef.current.shift()!;
    flushSync(() => {
      setMessages((prev) => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last.role !== "assistant") return msgs;
        const settled =
          last.animatingWord !== undefined
            ? last.content + last.animatingWord
            : last.content;
        return [
          ...msgs.slice(0, -1),
          {
            ...last,
            content: settled,
            animatingWord: word,
            wordKey: (last.wordKey ?? 0) + 1,
          },
        ];
      });
    });
    setTimeout(() => processNextWordRef.current(), WORD_MS);
  };

  // --- send handler ---
  const handleSend = async () => {
    if (!message.trim() || isPending) return;

    // Cancel any running word queue from a previous message
    wordQueueRef.current = [];
    pendingSourcesRef.current = null;
    isProcessingRef.current = false;

    const outgoing = message.trim();
    setMessages((prev) => [...prev, { role: "user", content: outgoing }]);
    setMessage("");
    setIsPending(true);

    let firstChunk = true;

    try {
      for await (const event of streamChatbot(outgoing)) {
        if ("error" in event) {
          wordQueueRef.current = [];
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: event.error || "Sorry, something went wrong." },
          ]);
          break;
        }

        if ("text" in event) {
          if (firstChunk) {
            flushSync(() => {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "", animatingWord: undefined, wordKey: 0, sources: [] },
              ]);
            });
            firstChunk = false;
          }
          // Split chunk into words (each includes its trailing whitespace)
          const words = event.text.match(/\S+\s*/g) ?? (event.text ? [event.text] : []);
          wordQueueRef.current.push(...words);
          if (!isProcessingRef.current) {
            isProcessingRef.current = true;
            setTimeout(() => processNextWordRef.current(), 0);
          }
        }

        if ("done" in event && event.done) {
          // Store sources — they'll be applied once the word queue drains
          pendingSourcesRef.current =
            event.sources?.map((s) => ({ title: s.title, similarity: s.similarity })) ?? [];
        }
      }
    } catch (err) {
      wordQueueRef.current = [];
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error ? err.message : "Sorry, I could not process your request right now.",
        },
      ]);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary hover:bg-primary-hover transition-all shadow-lg flex items-center justify-center"
        aria-label="Open chat"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-primary-foreground" />
        ) : (
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
        )}
      </button>

      {isOpen && (
        <div
          className="fixed bottom-24 right-3 z-50 glass-panel flex flex-col animate-scale-in sm:right-6 border border-border/50 shadow-xl rounded-xl overflow-hidden"
          style={{ width: size.width, height: size.height, maxWidth: "calc(100vw - 1.5rem)" }}
        >
          {/* Resize handle – top-left corner */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute top-0 left-0 z-10 w-6 h-6 flex items-end justify-end cursor-nw-resize rounded-br-lg hover:bg-white/10 transition-colors"
            title="Drag to resize"
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground/60 rotate-45 m-0.5" />
          </div>

          <div className="p-4 border-b border-white/20">
            <h3 className="font-heading font-semibold text-heading">TourWise AI Assistant</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/40 text-heading backdrop-blur-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <>
                      {renderMessage(msg.content)}
                      {msg.animatingWord !== undefined && (
                        <span
                          key={msg.wordKey}
                          className="animate-word-fade text-sm leading-relaxed"
                        >
                          {msg.animatingWord}
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/30 text-xs opacity-80 space-y-1">
                      {msg.sources.slice(0, 2).map((s, sIdx) => (
                        <div key={sIdx}>
                          Helpful source: {s.title || "Knowledge Base"}{" "}
                          {typeof s.similarity === "number"
                            ? `(${(s.similarity * 100).toFixed(0)}%)`
                            : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isPending && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-white/40 text-heading backdrop-blur-sm">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-white/20 flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your message..."
              className="flex-1 glass-panel"
              disabled={isPending}
            />
            <Button onClick={handleSend} size="icon" disabled={isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
