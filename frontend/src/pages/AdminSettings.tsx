import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettings() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Settings</h1>
        <p className="text-body-text">Configure platform settings and preferences</p>
      </div>

      <Card className="glass-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading">Platform Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Settings interface coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
