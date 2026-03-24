import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getUserProfile } from "@/lib/api";

const STORAGE_KEY = "tourwise_username_nudge_dismissed";

export function UsernameNudge() {
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) === "1" : false
  );

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
    enabled: !dismissed,
  });

  if (dismissed || isLoading) return null;

  const username = profile?.username?.trim();
  if (username) return null;

  return (
    <Alert className="mx-4 mt-4 border-primary/30 bg-primary/5">
      <AlertTitle className="font-heading">Add a display name</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-body-text">
          Choose a username so agents and other travelers recognize you. This is optional and only
          takes a moment.
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm">
            <Link to="/profile/edit">Add username</Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label="Dismiss"
            onClick={() => {
              localStorage.setItem(STORAGE_KEY, "1");
              setDismissed(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
