import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryChatbot } from "@/lib/api";

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string; sources?: Array<{ title?: string; similarity?: number }> }>
  >([
    { role: "assistant", content: "Hi! I'm your TourWise AI Assistant. How can I help you today?" }
  ]);

  const chatMutation = useMutation({
    mutationFn: (text: string) => queryChatbot({ message: text }),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources?.map((s) => ({ title: s.title, similarity: s.similarity })) ?? [],
        },
      ]);
    },
    onError: (error: Error) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error.message || "Sorry, I could not process your request right now.",
        },
      ]);
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;

    const outgoing = message.trim();
    setMessages((prev) => [...prev, { role: "user", content: outgoing }]);
    setMessage("");

    chatMutation.mutate(outgoing);
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
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] glass-panel flex flex-col animate-scale-in">
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
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/40 text-heading backdrop-blur-sm"
                  }`}
                >
                  {msg.content}
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/30 text-xs opacity-80 space-y-1">
                      {msg.sources.slice(0, 2).map((s, sIdx) => (
                        <div key={sIdx}>
                          Source: {s.title || "Knowledge Base"}{" "}
                          {typeof s.similarity === "number" ? `(${(s.similarity * 100).toFixed(0)}%)` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
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
              disabled={chatMutation.isPending}
            />
            <Button onClick={handleSend} size="icon" disabled={chatMutation.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
