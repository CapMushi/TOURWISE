import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  Shield,
  Edit2,
  Save,
  X,
  Briefcase,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAgentProfile, updateAgentProfile, getMyTrips, type AgentProfileData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatPkr } from "@/lib/currency";
import { format } from "date-fns";

function verificationBadge(status?: string | null) {
  switch (status) {
    case "approved":
    case "active":
    case "verified":
      return <Badge className="bg-green-500 text-white">Verified</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending Verification</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status ?? "Unknown"}</Badge>;
  }
}

export default function AgentProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery<AgentProfileData>({
    queryKey: ["agent-profile"],
    queryFn: getAgentProfile,
  });

  const { data: tripsData } = useQuery({
    queryKey: ["my-trips"],
    queryFn: getMyTrips,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setPhone((profile.contact_info?.phone as string) ?? "");
      setAddress((profile.contact_info?.address as string) ?? "");
      setBio((profile.profile_details?.bio as string) ?? "");
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateAgentProfile({
        name: name.trim() || undefined,
        contact_info: {
          ...(profile?.contact_info ?? {}),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
        },
        profile_details: {
          ...(profile?.profile_details ?? {}),
          bio: bio.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your agent profile has been saved." });
      queryClient.invalidateQueries({ queryKey: ["agent-profile"] });
      setEditing(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Update failed",
        description: (err as Error)?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCancel = () => {
    if (profile) {
      setName(profile.name ?? "");
      setPhone((profile.contact_info?.phone as string) ?? "");
      setAddress((profile.contact_info?.address as string) ?? "");
      setBio((profile.profile_details?.bio as string) ?? "");
    }
    setEditing(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {(error as Error).message ?? "Failed to load agent profile."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const trips = tripsData?.trips ?? [];
  const phone_ = (profile?.contact_info?.phone as string) || null;
  const address_ = (profile?.contact_info?.address as string) || null;
  const bio_ = (profile?.profile_details?.bio as string) || null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-heading font-bold text-heading">My Profile</h1>
          <p className="text-body-text mt-1">Manage your travel agent information</p>
        </div>
        {!editing && (
          <Button onClick={() => setEditing(true)} variant="outline" className="gap-2">
            <Edit2 className="h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      {/* Profile Card */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-10 w-10 text-primary" />
              </div>
              <div>
                {editing ? (
                  <div className="space-y-1">
                    <Label htmlFor="name" className="text-xs text-muted-foreground">
                      Business / Display Name
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-xl font-heading font-bold h-10 w-64"
                      placeholder="Your agency name"
                    />
                  </div>
                ) : (
                  <h2 className="text-2xl font-heading font-bold text-heading">
                    {profile?.name ?? "Unnamed Agent"}
                  </h2>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {verificationBadge(profile?.verification_status)}
                  {profile?.rating != null && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      {profile.rating.toFixed(1)} ({profile.numberofreviews ?? 0} reviews)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-heading font-semibold text-heading">Contact Information</h3>

              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-body-text text-sm">{profile?.email ?? "No email on file"}</span>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                {editing ? (
                  <div className="flex-1">
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+92 300 0000000"
                      className="h-8 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-body-text text-sm">{phone_ ?? "No phone number"}</span>
                )}
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                {editing ? (
                  <div className="flex-1">
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Office address"
                      className="h-8 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-body-text text-sm">{address_ ?? "No address"}</span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-heading font-semibold text-heading">About</h3>
              {editing ? (
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your agency, specializations, years of experience..."
                  rows={5}
                />
              ) : (
                <p className="text-body-text text-sm leading-relaxed">
                  {bio_ ?? "No bio provided. Click Edit Profile to add a description of your agency."}
                </p>
              )}
            </div>
          </div>

          {/* Account Info */}
          <div className="border-t pt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span>Agent ID #{profile?.agent_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>{profile?.verification_status ?? "unknown"}</span>
            </div>
            {profile?.created_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Joined {format(new Date(profile.created_at), "MMM yyyy")}</span>
              </div>
            )}
          </div>

          {/* Edit Actions */}
          {editing && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={handleCancel} className="gap-2">
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Trips Summary */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="font-heading">My Trips ({trips.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no trips yet.</p>
          ) : (
            <div className="space-y-3">
              {trips.slice(0, 8).map((trip) => (
                <div
                  key={trip.trip_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {trip.origin_city} → {trip.destination_city}
                    </span>
                    <span className="ml-3 text-muted-foreground">
                      {format(new Date(trip.departure_time), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {trip.available_seats}/{trip.total_seats} seats
                    </span>
                    <Badge variant="outline">{formatPkr(trip.price)}</Badge>
                  </div>
                </div>
              ))}
              {trips.length > 8 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  + {trips.length - 8} more trips — visit Manage Trips to see all
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
