import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera } from "lucide-react";
import { getUserProfile, updateUserProfile, uploadProfileImage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["Adventure", "Cultural"]);
  const [budget, setBudget] = useState("Mid-Range");
  const [intentText, setIntentText] = useState("");
  const [pace, setPace] = useState("moderate");
  const [crowdPref, setCrowdPref] = useState("balanced");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
  });

  const displayEmail = profile?.email ?? user?.email ?? "";
  const displayName = profile?.username?.trim() || user?.email?.split("@")[0] || "Traveler";
  const avatarUrl =
    profile?.profile_details && typeof profile.profile_details === "object"
      ? ((profile.profile_details as Record<string, unknown>).avatar_url as string | undefined)
      : undefined;

  useEffect(() => {
    const prefs = profile?.preferences;
    if (!prefs || typeof prefs !== "object") return;
    const p = prefs as Record<string, unknown>;
    const styleRaw = p.trip_style;
    if (Array.isArray(styleRaw) && styleRaw.length) {
      setSelectedStyles(styleRaw.filter((v): v is string => typeof v === "string"));
    } else if (typeof styleRaw === "string" && styleRaw.trim()) {
      setSelectedStyles([styleRaw]);
    }
    if (typeof p.budget_band === "string" && p.budget_band.trim()) {
      setBudget(p.budget_band);
    }
    if (typeof p.intent_text === "string") {
      setIntentText(p.intent_text);
    }
    if (typeof p.pace === "string" && p.pace.trim()) {
      setPace(p.pace);
    }
    if (typeof p.crowd_pref === "string" && p.crowd_pref.trim()) {
      setCrowdPref(p.crowd_pref);
    }
  }, [profile?.preferences]);

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const savePreferencesMutation = useMutation({
    mutationFn: async () => {
      const currentPreferences =
        profile?.preferences && typeof profile.preferences === "object"
          ? (profile.preferences as Record<string, unknown>)
          : {};
      return updateUserProfile({
        preferences: {
          ...currentPreferences,
          trip_style: selectedStyles,
          budget_band: budget,
          intent_text: intentText.trim(),
          pace,
          crowd_pref: crowdPref,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["home-recommendations"] });
      toast({ title: "Preferences saved", description: "AI preferences updated successfully." });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message || "Could not save preferences",
        variant: "destructive",
      });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) {
        throw new Error("You must be logged in to upload a profile photo.");
      }

      const uploadedUrl = await uploadProfileImage(file, user.id, "traveler");
      const currentDetails =
        profile?.profile_details && typeof profile.profile_details === "object"
          ? (profile.profile_details as Record<string, unknown>)
          : {};

      return updateUserProfile({
        profile_details: {
          ...currentDetails,
          avatar_url: uploadedUrl,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({ title: "Photo updated", description: "Your profile picture has been uploaded." });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload your profile picture.",
        variant: "destructive",
      });
    },
  });

  const handlePhotoSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please choose an image file.",
        variant: "destructive",
      });
      return;
    }

    uploadPhotoMutation.mutate(file);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
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
                    <AvatarImage src={avatarUrl} alt="Profile picture" />
                    <AvatarFallback className="text-2xl font-heading bg-primary text-primary-foreground">
                      {initialsFromUser(profile?.username, displayEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <h3 className="font-heading font-bold text-xl text-heading">{displayName}</h3>
                    <p className="text-body-text">{displayEmail}</p>
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelected}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadPhotoMutation.isPending}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {uploadPhotoMutation.isPending ? "Uploading photo..." : "Upload Profile Photo"}
                  </Button>
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

              <div className="space-y-3">
                <Label className="text-sm font-medium text-heading">Describe your ideal trip intent</Label>
                <Input
                  value={intentText}
                  onChange={(e) => setIntentText(e.target.value)}
                  placeholder="e.g., Relaxing weekend family trip under PKR 30,000 with shorter travel time"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Pace</Label>
                  <Select value={pace} onValueChange={setPace}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slow">Slow</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="fast">Fast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Crowd preference</Label>
                  <Select value={crowdPref} onValueChange={setCrowdPref}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quiet">Quiet</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="popular">Popular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => savePreferencesMutation.mutate()}
                disabled={savePreferencesMutation.isPending}
              >
                Save Preferences
              </Button>

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
