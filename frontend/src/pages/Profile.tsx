import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserProfile } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const travelStyles = [
  "Adventure",
  "Relaxation",
  "Cultural",
  "Family-Friendly",
  "Luxury",
];

function initialsFromUser(username: string | null | undefined, email: string | null | undefined) {
  const u = username?.trim();
  if (u) {
    const parts = u.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    return u.slice(0, 2).toUpperCase();
  }
  const e = email?.trim();
  if (e && e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "TW";
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["Adventure", "Cultural"]);
  const [budget, setBudget] = useState("Mid-Range");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
  });

  const displayEmail = profile?.email ?? user?.email ?? "";
  const displayName = profile?.username?.trim() || user?.email?.split("@")[0] || "Traveler";

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="font-heading text-4xl font-bold text-heading mb-8">My Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center space-y-4">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src="/placeholder.svg" alt="Profile picture" />
                    <AvatarFallback className="text-2xl font-heading bg-primary text-primary-foreground">
                      {initialsFromUser(profile?.username, displayEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <h3 className="font-heading font-bold text-xl text-heading">{displayName}</h3>
                    <p className="text-body-text">{displayEmail}</p>
                  </div>
                </div>
              )}
              <Button variant="secondary" className="w-full" onClick={() => navigate("/profile/edit")}>
                Edit Profile
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">Account Security</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Change Password</Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">Your Travel Preferences</CardTitle>
              <CardDescription>Help our AI find the perfect trips for you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-heading">I enjoy trips that are...</label>
                <div className="flex flex-wrap gap-2">
                  {travelStyles.map((style) => (
                    <Badge
                      key={style}
                      variant={selectedStyles.includes(style) ? "default" : "outline"}
                      className={`cursor-pointer transition-colors ${
                        selectedStyles.includes(style)
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`}
                      onClick={() => toggleStyle(style)}
                    >
                      {style}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-heading">My typical budget is...</label>
                <Select value={budget} onValueChange={setBudget}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Budget-Friendly">Budget-Friendly</SelectItem>
                    <SelectItem value="Mid-Range">Mid-Range</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full">Save Preferences</Button>

              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => navigate("/update-preferences")}
              >
                Update Preferences
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
