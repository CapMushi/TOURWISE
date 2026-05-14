import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Upload, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import {
  submitAgentApplication,
  uploadAgentDocument,
  type AgentApplicationPayload,
  type AgentDocumentKind,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// CNIC must look like 12345-1234567-1 (with or without dashes).
const CNIC_PATTERN = /^\d{5}-?\d{7}-?\d$/;

type DocumentSlotState = {
  file: File | null;
  uploadedPath: string | null;
};

const emptyDoc: DocumentSlotState = { file: null, uploadedPath: null };

export default function AgentVerification() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, session, loading, isAgent, agentVerificationStatus, refreshAgentVerificationStatus } = useAuth();

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnicNumber, setCnicNumber] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");

  const [cnicFront, setCnicFront] = useState<DocumentSlotState>(emptyDoc);
  const [cnicBack, setCnicBack] = useState<DocumentSlotState>(emptyDoc);
  const [businessLicense, setBusinessLicense] = useState<DocumentSlotState>(emptyDoc);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Redirect to login if not authenticated; redirect to /agent if already approved.
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { state: { from: { pathname: "/agent-verification" } } });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (agentVerificationStatus === "approved") {
      navigate("/agent", { replace: true });
    }
  }, [agentVerificationStatus, navigate]);

  const cnicValid = useMemo(() => CNIC_PATTERN.test(cnicNumber.trim()), [cnicNumber]);

  const formReady = useMemo(() => {
    return (
      businessName.trim().length >= 2 &&
      phone.trim().length >= 5 &&
      cnicValid &&
      cnicFront.file !== null &&
      cnicBack.file !== null
    );
  }, [businessName, phone, cnicValid, cnicFront.file, cnicBack.file]);

  const isReadOnlyPending = isAgent && agentVerificationStatus === "pending";

  const handleSubmit = async () => {
    if (!user || !session) {
      toast({
        title: "Not signed in",
        description: "Please log in before submitting your application.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    if (!cnicFront.file || !cnicBack.file) {
      setSubmitError("Both sides of your CNIC are required.");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      const cnicFrontPath = await uploadAgentDocument(cnicFront.file, user.id, "cnic_front");
      const cnicBackPath = await uploadAgentDocument(cnicBack.file, user.id, "cnic_back");
      let businessLicensePath: string | undefined;
      if (businessLicense.file) {
        businessLicensePath = await uploadAgentDocument(
          businessLicense.file,
          user.id,
          "business_license",
        );
      }

      const payload: AgentApplicationPayload = {
        business_name: businessName.trim(),
        phone: phone.trim(),
        cnic_number: cnicNumber.trim(),
        address: address.trim() || undefined,
        bio: bio.trim() || undefined,
        documents: {
          cnic_front_path: cnicFrontPath,
          cnic_back_path: cnicBackPath,
          business_license_path: businessLicensePath,
        },
      };

      await submitAgentApplication(payload);

      toast({
        title: "Application submitted",
        description: "An admin will review your documents shortly.",
      });

      if (refreshAgentVerificationStatus) {
        await refreshAgentVerificationStatus();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit application.";
      setSubmitError(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-panel max-w-md w-full border-0 text-center">
          <CardContent className="p-6">
            <p className="text-body-text">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user || !session) {
    return null;
  }

  if (isReadOnlyPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-panel max-w-xl w-full border-0">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="font-heading text-2xl">Application Received</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <Badge variant="secondary" className="mx-auto">Pending Review</Badge>
            <p className="text-body-text">
              Your travel-agent application is queued for admin review. We compare your CNIC and business
              details before approval — this usually takes a business day.
            </p>
            <p className="text-sm text-muted-foreground">
              You'll get access to the agent dashboard the moment an admin approves your account.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>Back to home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-heading">Become a Travel Agent</h1>
          <p className="text-body-text max-w-xl mx-auto">
            Submit your business details and CNIC so an admin can verify and approve your account. Documents
            are stored privately and only visible to the verification team.
          </p>
        </div>

        {agentVerificationStatus === "rejected" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Your previous application was rejected</AlertTitle>
            <AlertDescription>
              Update the fields below and re-upload your documents. Submitting will queue your request again.
            </AlertDescription>
          </Alert>
        )}

        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading">Business information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="business-name">Business / agency name *</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Pamir Adventures"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="phone">Contact phone *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="address">Business address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Optional"
                disabled={submitting}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="bio">Short bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell travelers about your experience, specialties, and the regions you cover."
                rows={3}
                disabled={submitting}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0">
          <CardHeader>
            <CardTitle className="font-heading">Identity verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="cnic">CNIC number *</Label>
              <Input
                id="cnic"
                value={cnicNumber}
                onChange={(e) => setCnicNumber(e.target.value)}
                placeholder="12345-1234567-1"
                disabled={submitting}
              />
              {cnicNumber.length > 0 && !cnicValid && (
                <p className="text-sm text-destructive mt-1">
                  Enter exactly 13 digits, e.g. 12345-1234567-1.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <DocumentSlot
                kind="cnic_front"
                label="CNIC front *"
                accept="image/jpeg,image/png,image/webp"
                state={cnicFront}
                onChange={setCnicFront}
                disabled={submitting}
              />
              <DocumentSlot
                kind="cnic_back"
                label="CNIC back *"
                accept="image/jpeg,image/png,image/webp"
                state={cnicBack}
                onChange={setCnicBack}
                disabled={submitting}
              />
              <DocumentSlot
                kind="business_license"
                label="Business license (optional)"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                state={businessLicense}
                onChange={setBusinessLicense}
                disabled={submitting}
                helperText="PDF or image. Speeds up review when available."
              />
            </div>
          </CardContent>
        </Card>

        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => navigate("/")} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!formReady || submitting} className="min-w-[180px]">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Submit application
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DocumentSlotProps {
  kind: AgentDocumentKind;
  label: string;
  accept: string;
  state: DocumentSlotState;
  onChange: (next: DocumentSlotState) => void;
  disabled?: boolean;
  helperText?: string;
}

function DocumentSlot({ kind, label, accept, state, onChange, disabled, helperText }: DocumentSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => {
    if (!state.file) return null;
    if (state.file.type.startsWith("image/")) {
      return URL.createObjectURL(state.file);
    }
    return null;
  }, [state.file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = (file: File | null) => {
    onChange({ file, uploadedPath: null });
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-2">
      <Label className="text-sm">{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        disabled={disabled}
      />
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`${kind} preview`}
          className="h-32 w-full object-cover rounded-md border border-border/40"
        />
      ) : state.file ? (
        <div className="h-32 w-full flex items-center justify-center rounded-md border border-dashed border-border/40 text-sm text-muted-foreground gap-2">
          <FileText className="h-4 w-4" />
          {state.file.name}
        </div>
      ) : (
        <div className="h-32 w-full flex items-center justify-center rounded-md border border-dashed border-border/40 text-sm text-muted-foreground">
          No file chosen
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {state.file ? "Replace" : "Choose file"}
        </Button>
        {state.file && (
          <span className="inline-flex items-center text-xs text-emerald-600 gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready to upload
          </span>
        )}
      </div>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}
