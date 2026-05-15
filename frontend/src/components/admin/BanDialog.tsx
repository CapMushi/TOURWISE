import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Ban, Loader2 } from "lucide-react";
import type { BanDuration } from "@/lib/api";

export interface BanDialogSubject {
  kind: "traveler" | "agent";
  displayName: string;
  /** Surfaced in the agent warning callout so the admin knows exactly which
   *  CNIC will be blocklisted. */
  cnicNumber?: string | null;
}

interface BanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: BanDialogSubject | null;
  busy?: boolean;
  onSubmit: (input: { duration?: BanDuration; reason: string }) => Promise<void> | void;
}

const DURATION_OPTIONS: { value: BanDuration; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "permanent", label: "Permanent" },
];

export function BanDialog({ open, onOpenChange, subject, busy, onSubmit }: BanDialogProps) {
  const [duration, setDuration] = useState<BanDuration>("7d");
  const [reason, setReason] = useState("");

  // Reset state every time the dialog re-opens so we don't leak the previous
  // applicant's reason text into the next one.
  useEffect(() => {
    if (open) {
      setDuration("7d");
      setReason("");
    }
  }, [open, subject?.kind, subject?.displayName]);

  if (!subject) return null;
  const isAgent = subject.kind === "agent";
  const reasonReady = reason.trim().length >= 3;
  const submitDisabled = busy || !reasonReady;

  const handleSubmit = async () => {
    if (!reasonReady) return;
    await onSubmit({
      duration: isAgent ? undefined : duration,
      reason: reason.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            {isAgent ? `Ban agent ${subject.displayName}` : `Ban traveler ${subject.displayName}`}
          </DialogTitle>
          <DialogDescription>
            {isAgent
              ? "Banning an agent locks their account permanently and prevents this CNIC from being used to register as an agent again from any account."
              : "Choose how long the account should be locked. The traveler can still register a new account with a different email; existing sessions are killed immediately."}
          </DialogDescription>
        </DialogHeader>

        {isAgent && (
          <Alert variant="destructive" className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              CNIC{" "}
              <span className="font-mono font-medium">
                {subject.cnicNumber ?? "(none on file)"}
              </span>{" "}
              will be added to the blocklist. Unbanning later lifts both the account lock and the
              CNIC blocklist entry; the agent's verification status is set back to "rejected" so a
              fresh admin review is required before they can list trips again.
            </AlertDescription>
          </Alert>
        )}

        {!isAgent && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Ban duration</Label>
            <RadioGroup
              value={duration}
              onValueChange={(value) => setDuration(value as BanDuration)}
              className="grid grid-cols-2 gap-2"
              disabled={busy}
            >
              {DURATION_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`ban-duration-${opt.value}`}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 cursor-pointer hover:bg-accent/40"
                >
                  <RadioGroupItem id={`ban-duration-${opt.value}`} value={opt.value} />
                  <span className="text-sm">{opt.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="ban-reason" className="text-sm font-medium">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isAgent
                ? "e.g. repeated cancellation fraud; CNIC traced to multiple sock-puppet accounts"
                : "e.g. abusive messages to agents; spam reviews"
            }
            rows={3}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">
            Stored on the account and (for agents) on the CNIC blocklist. The user does not see this
            text directly — they only see "Account suspended".
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitDisabled}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Banning...
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                {isAgent ? "Ban agent & blocklist CNIC" : "Ban account"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
