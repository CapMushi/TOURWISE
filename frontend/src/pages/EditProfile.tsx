import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUserProfile, updateUserProfile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
  });

  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
    }
  }, [profile?.username]);

  const mutation = useMutation({
    mutationFn: (name: string) => updateUserProfile({ username: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({ title: "Profile updated" });
      navigate("/profile");
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Enter a display name or cancel to go back.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(username.trim());
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-8">
      <h1 className="font-heading text-3xl font-bold text-heading mb-6">Edit profile</h1>

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="font-heading">Display name</CardTitle>
          <CardDescription>
            This is how your name appears across TourWise. Email is managed in your account security
            settings (Supabase Auth).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {profile?.email && (
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={profile.email} disabled className="bg-muted/50" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="How should we call you?"
                  maxLength={80}
                  autoComplete="nickname"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/profile")}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
