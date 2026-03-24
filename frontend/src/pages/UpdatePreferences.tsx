import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferencesUpdate,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function UpdatePreferences() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    booking_updates: true,
    payment_updates: true,
    trip_reminders: true,
    promotions: false,
    agent_messages: true,
    in_app_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    push_enabled: false,
    quiet_hours_start: "",
    quiet_hours_end: "",
    timezone: "UTC",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });

  useEffect(() => {
    if (!data) return;
    setFormData({
      booking_updates: data.booking_updates,
      payment_updates: data.payment_updates,
      trip_reminders: data.trip_reminders,
      promotions: data.promotions,
      agent_messages: data.agent_messages,
      in_app_enabled: data.in_app_enabled,
      email_enabled: data.email_enabled,
      sms_enabled: data.sms_enabled,
      push_enabled: data.push_enabled,
      quiet_hours_start: data.quiet_hours_start || "",
      quiet_hours_end: data.quiet_hours_end || "",
      timezone: data.timezone || "UTC",
    });
  }, [data]);

  const handleCheckboxChange = (key: keyof typeof formData) => {
    const currentValue = Boolean(formData[key]);
    setFormData(prev => ({
      ...prev,
      [key]: !currentValue,
    }));
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: NotificationPreferencesUpdate = {
        ...formData,
        quiet_hours_start: formData.quiet_hours_start || undefined,
        quiet_hours_end: formData.quiet_hours_end || undefined,
      };
      await updateNotificationPreferences(payload);
      toast({ title: "Notification preferences updated" });
      navigate("/profile");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to update preferences",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="glass-panel max-w-2xl w-full border-0">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-3xl mb-2">
            Notification Preferences
          </CardTitle>
          <CardDescription className="text-body-text text-base">
            Control what updates you receive and where we send them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveChanges} className="space-y-8">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Notification Categories</Label>
              {[
                ["booking_updates", "Booking Updates"],
                ["payment_updates", "Payment Updates"],
                ["trip_reminders", "Trip Reminders"],
                ["promotions", "Promotions"],
                ["agent_messages", "Agent Messages"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={Boolean(formData[key as keyof typeof formData])}
                    onCheckedChange={() => handleCheckboxChange(key as keyof typeof formData)}
                    disabled={isLoading}
                  />
                  <Label htmlFor={key} className="font-normal cursor-pointer">{label}</Label>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Delivery Channels</Label>
              {[
                ["in_app_enabled", "In-App"],
                ["email_enabled", "Email"],
                ["sms_enabled", "SMS"],
                ["push_enabled", "Push"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={Boolean(formData[key as keyof typeof formData])}
                    onCheckedChange={() => handleCheckboxChange(key as keyof typeof formData)}
                    disabled={isLoading}
                  />
                  <Label htmlFor={key} className="font-normal cursor-pointer">{label}</Label>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Quiet Hours</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="quietStart">Start</Label>
                  <input
                    id="quietStart"
                    type="time"
                    value={formData.quiet_hours_start}
                    onChange={(e) => setFormData(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="quietEnd">End</Label>
                  <input
                    id="quietEnd"
                    type="time"
                    value={formData.quiet_hours_end}
                    onChange={(e) => setFormData(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <input
                    id="timezone"
                    type="text"
                    value={formData.timezone}
                    onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Loading..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
