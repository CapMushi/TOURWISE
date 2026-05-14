import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileText,
  ImageIcon,
  ExternalLink,
  ShieldCheck,
  ShieldOff,
  Clock,
  AlertCircle,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { BanDialog } from "@/components/admin/BanDialog";
import {
  banAgent,
  getAdminAgentDetail,
  reviewAgentVerification,
  unbanAgent,
  type AdminAgentDetail,
} from "@/lib/api";

function describeAgentBan(banned_until?: string | null): { permanent: boolean; label: string } | null {
  if (!banned_until) return null;
  if (banned_until.toLowerCase() === "infinity" || banned_until.toLowerCase() === "+infinity") {
    return { permanent: true, label: "Banned permanently" };
  }
  try {
    const date = new Date(banned_until);
    if (Number.isNaN(date.getTime())) return null;
    if (date <= new Date()) return null;
    return { permanent: false, label: `Banned until ${format(date, "MMM d, yyyy")}` };
  } catch {
    return null;
  }
}

type StatusKey = "pending" | "approved" | "rejected" | "unknown";

const statusKey = (value?: string | null): StatusKey => {
  if (value === "pending" || value === "approved" || value === "rejected") return value;
  return "unknown";
};

const STATUS_META: Record<StatusKey, { label: string; className: string; icon: typeof ShieldCheck }> = {
  pending: { label: "Pending review", className: "bg-amber-500/10 text-amber-700 border-amber-500/40", icon: Clock },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/40", icon: ShieldCheck },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/40", icon: AlertCircle },
  unknown: { label: "Unknown", className: "bg-muted text-muted-foreground border-border", icon: ShieldCheck },
};

function formatDateTime(value?: string | null) {
  if (!value) return "Unknown";
  try {
    return format(new Date(value), "MMM d, yyyy 'at' p");
  } catch {
    return value;
  }
}

export default function AgentProfileDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cameFromPending = searchParams.get("from") === "pending";

  const agentId = Number(id);
  const agentIdValid = Number.isFinite(agentId) && agentId > 0;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-agent-detail", agentId],
    queryFn: () => getAdminAgentDetail(agentId),
    enabled: agentIdValid,
    refetchInterval: 60_000,
  });

  const decisionMutation = useMutation({
    mutationFn: (decision: "approved" | "rejected") => reviewAgentVerification(agentId, decision),
    onSuccess: (response) => {
      toast.success(response.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-agent-detail", agentId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      if (cameFromPending) {
        navigate("/admin/manage-agents");
      }
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : "Failed to update verification status");
    },
  });

  const banMutation = useMutation({
    mutationFn: (reason: string) => banAgent(agentId, { reason }),
    onSuccess: (response) => {
      toast.success(response.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-agent-detail", agentId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to ban agent");
    },
  });

  const unbanMutation = useMutation({
    mutationFn: () => unbanAgent(agentId),
    onSuccess: (response) => {
      toast.success(response.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-agent-detail", agentId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to unban agent");
    },
  });

  if (!agentIdValid) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <p className="mt-6 text-destructive">Invalid agent id in URL.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Failed to load agent."}
        </p>
      </div>
    );
  }

  return <AgentProfileDetailContent
    data={data}
    cameFromPending={cameFromPending}
    decisionPending={decisionMutation.isPending}
    onDecision={(decision) => decisionMutation.mutate(decision)}
    onBack={() => navigate(-1)}
    banPending={banMutation.isPending}
    unbanPending={unbanMutation.isPending}
    onBan={(reason) => banMutation.mutateAsync(reason)}
    onUnban={() => unbanMutation.mutate()}
  />;
}

interface ContentProps {
  data: AdminAgentDetail;
  cameFromPending: boolean;
  decisionPending: boolean;
  onDecision: (decision: "approved" | "rejected") => void;
  onBack: () => void;
  banPending: boolean;
  unbanPending: boolean;
  onBan: (reason: string) => Promise<unknown>;
  onUnban: () => void;
}

function AgentProfileDetailContent({
  data,
  cameFromPending,
  decisionPending,
  onDecision,
  onBack,
  banPending,
  unbanPending,
  onBan,
  onUnban,
}: ContentProps) {
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const status = statusKey(data.verification_status);
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;

  const bio = useMemo(() => {
    const value = data.profile_details?.bio;
    return typeof value === "string" && value.trim() ? value : null;
  }, [data.profile_details]);

  const avatarUrl = useMemo(() => {
    const value = data.profile_details?.avatar_url;
    return typeof value === "string" && value.trim() ? value : null;
  }, [data.profile_details]);

  const address = useMemo(() => {
    const value = data.contact_info?.address;
    return typeof value === "string" && value.trim() ? value : null;
  }, [data.contact_info]);

  const banInfo = describeAgentBan(data.banned_until);
  const showBanned = data.is_banned || banInfo !== null;
  const showDecisionBar = status === "pending";
  // Show the Ban/Unban affordance only for approved agents (Pending agents
  // use the approve/reject decision flow instead).
  const showModerationBar = status === "approved";

  return (
    <div className="p-8 space-y-8">
      <Button variant="ghost" onClick={onBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={data.name}
              className="h-16 w-16 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-heading font-bold text-heading leading-tight">
              {data.business_name || data.name || "Unnamed Agent"}
            </h1>
            <p className="text-body-text">{data.name}</p>
          </div>
        </div>
        <Badge variant="outline" className={`px-3 py-1.5 text-sm ${meta.className}`}>
          <StatusIcon className="h-4 w-4 mr-1.5" />
          {meta.label}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Email" value={data.email} />
            <Field label="Phone" value={data.phone} />
            <Field label="Address" value={address} />
          </CardContent>
        </Card>

        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="CNIC number" value={data.cnic_number} mono />
            <Field label="Submitted at" value={formatDateTime(data.submitted_at)} />
            <Field label="Account created" value={formatDateTime(data.created_at)} />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Account status</span>
              <span className="text-right">
                {showBanned ? (
                  <Badge variant="destructive" className="font-normal">
                    <ShieldOff className="h-3 w-3 mr-1" />
                    {banInfo?.label ?? "Banned"}
                  </Badge>
                ) : (
                  <span className="inline-flex items-center text-emerald-600">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                    Active
                  </span>
                )}
              </span>
            </div>
            {showBanned && data.ban_reason && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                <span className="font-medium text-destructive">Reason:</span>{" "}
                <span className="text-foreground">{data.ban_reason}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {bio && (
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading">About this agent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{bio}</p>
          </CardContent>
        </Card>
      )}

      <Card className="glass-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading">Submitted documents</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <DocumentTile label="CNIC — front" url={data.documents.cnic_front_url} />
          <DocumentTile label="CNIC — back" url={data.documents.cnic_back_url} />
          <DocumentTile label="Business license" url={data.documents.business_license_url} optional />
        </CardContent>
      </Card>

      {status === "approved" && (
        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading">Activity</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="Total trips hosted" value={data.total_trips.toString()} />
            <StatCard
              label="Average rating"
              value={data.rating != null ? `${data.rating.toFixed(1)} ⭐` : "No ratings yet"}
            />
            <StatCard label="Reviews" value={data.numberofreviews.toString()} />
          </CardContent>
        </Card>
      )}

      {showDecisionBar && (
        <>
          <Separator />
          <Card className="glass-panel border-0">
            <CardHeader>
              <CardTitle className="font-heading">Decision</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="destructive"
                onClick={() => onDecision("rejected")}
                disabled={decisionPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject application
              </Button>
              <Button
                onClick={() => onDecision("approved")}
                disabled={decisionPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve agent
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {showModerationBar && (
        <>
          <Separator />
          <Card className="glass-panel border-0">
            <CardHeader>
              <CardTitle className="font-heading">Moderation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <p className="text-sm text-muted-foreground">
                {showBanned
                  ? "Unbanning lifts both the account lock and the CNIC blocklist. The agent will need a fresh admin review before they can list trips again."
                  : "Banning permanently locks this account AND blocklists their CNIC from any future agent registration."}
              </p>
              <div className="flex gap-2 sm:justify-end">
                {showBanned ? (
                  <Button variant="outline" onClick={onUnban} disabled={unbanPending}>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Unban agent
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => setBanDialogOpen(true)}
                    disabled={banPending}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Ban agent
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <BanDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        subject={{
          kind: "agent",
          displayName: data.business_name || data.name || "this agent",
          cnicNumber: data.cnic_number,
        }}
        busy={banPending}
        onSubmit={async ({ reason }) => {
          await onBan(reason);
          setBanDialogOpen(false);
        }}
      />
    </div>
  );
}

interface FieldProps {
  label: string;
  value?: string | null;
  mono?: boolean;
}

function Field({ label, value, mono }: FieldProps) {
  const content =
    value && value.trim().length > 0 ? (
      <span className={mono ? "font-mono" : ""}>{value}</span>
    ) : (
      <span className="text-muted-foreground italic">Not provided</span>
    );
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{content}</span>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-4">
      <p className="text-2xl font-bold text-heading">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

interface DocumentTileProps {
  label: string;
  url?: string | null;
  optional?: boolean;
}

function DocumentTile({ label, url, optional }: DocumentTileProps) {
  const [open, setOpen] = useState(false);

  if (!url) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 bg-card/30 p-4 text-center space-y-2">
        <FileText className="h-6 w-6 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {optional ? "Optional — not uploaded" : "Not uploaded"}
        </p>
      </div>
    );
  }

  const isPdf = url.toLowerCase().includes(".pdf");

  return (
    <>
      <div className="rounded-lg border border-border/50 bg-card/40 overflow-hidden">
        <button
          type="button"
          onClick={() => !isPdf && setOpen(true)}
          className="block w-full"
          aria-label={`Open ${label}`}
        >
          {isPdf ? (
            <div className="aspect-[4/3] flex flex-col items-center justify-center gap-2 bg-muted/40">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">PDF document</span>
            </div>
          ) : (
            <div className="aspect-[4/3] bg-muted/30">
              <img src={url} alt={label} className="h-full w-full object-cover" />
            </div>
          )}
        </button>
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{label}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs inline-flex items-center text-primary hover:underline"
          >
            {isPdf ? "Open" : "Full size"}
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </div>
      </div>

      {!isPdf && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              {label}
            </DialogTitle>
            <img src={url} alt={label} className="w-full h-auto rounded-md" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
