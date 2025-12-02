import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const flaggedItems = [
  {
    id: 1,
    type: "Review",
    content: "This trip was a complete scam! The agent never showed up and took our money!",
    author: "John Doe",
    reason: "Harassment",
    reporter: "Jane Smith",
    date: "2025-11-27",
  },
  {
    id: 2,
    type: "Comment",
    content: "Buy cheap flights at www.scam-site.com! Best deals ever!!!",
    author: "SpamBot123",
    reason: "Spam",
    reporter: "Agent TravelCo",
    date: "2025-11-26",
  },
  {
    id: 3,
    type: "Review",
    content: "The guide was extremely rude and unprofessional throughout the entire trip.",
    author: "Alice Williams",
    reason: "Inappropriate Content",
    reporter: "Bob Johnson",
    date: "2025-11-25",
  },
];

export default function ModerationQueue() {
  const [items, setItems] = useState(flaggedItems);

  const handleDismiss = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
    toast.success("Report dismissed - content kept");
  };

  const handleDelete = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
    toast.error("Content deleted and warning issued to author");
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Reports & Moderation</h1>
        <p className="text-body-text">Review flagged content and take appropriate action</p>
      </div>

      <Card className="glass-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading">Moderation Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No flagged items to review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="glass-panel border border-border/50">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary">{item.type}</Badge>
                            <Badge variant="destructive">{item.reason}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Posted by <span className="font-medium text-foreground">{item.author}</span> on {item.date}
                          </p>
                          <p className="text-sm text-muted-foreground mb-3">
                            Reported by <span className="font-medium text-foreground">{item.reporter}</span>
                          </p>
                          <div className="bg-muted/30 p-4 rounded-md border border-border/30">
                            <p className="text-foreground">{item.content}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-3 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDismiss(item.id)}
                        >
                          Dismiss Report
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete Content
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
