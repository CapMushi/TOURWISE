import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const travelStyles = [
  "Adventure",
  "Relaxation",
  "Cultural",
  "Family-Friendly",
  "Luxury"
];

export default function Profile() {
  const navigate = useNavigate();
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["Adventure", "Cultural"]);
  const [budget, setBudget] = useState("Mid-Range");

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style)
        ? prev.filter((s) => s !== style)
        : [...prev, style]
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="font-heading text-4xl font-bold text-heading mb-8">My Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Personal Information Card */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src="/placeholder.svg" alt="Profile picture" />
                  <AvatarFallback className="text-2xl font-heading bg-primary text-primary-foreground">
                    AD
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="font-heading font-bold text-xl text-heading">Alex Doe</h3>
                  <p className="text-body-text">alex.doe@email.com</p>
                </div>
              </div>
              <Button variant="secondary" className="w-full">
                Edit Profile
              </Button>
            </CardContent>
          </Card>

          {/* Account Security Card */}
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">Account Security</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Change Password</Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div>
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">Your Travel Preferences</CardTitle>
              <CardDescription>
                Help our AI find the perfect trips for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preferred Travel Styles */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-heading">
                  I enjoy trips that are...
                </label>
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

              {/* Average Budget */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-heading">
                  My typical budget is...
                </label>
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

              {/* Save Button */}
              <Button className="w-full">Save Preferences</Button>

              {/* Update Preferences Button */}
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
