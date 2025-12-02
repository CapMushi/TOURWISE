import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function UpdatePreferences() {
  const navigate = useNavigate();
  // Pre-populated with saved user preferences
  const [formData, setFormData] = useState({
    budget: "standard",
    travelStyles: ["Adventurous", "Cultural"]
  });

  const handleCheckboxChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      travelStyles: prev.travelStyles.includes(value) 
        ? prev.travelStyles.filter(item => item !== value)
        : [...prev.travelStyles, value]
    }));
  };

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    // Save updated preferences (in a real app, this would save to backend)
    navigate("/profile");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="glass-panel max-w-2xl w-full border-0">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-3xl mb-2">
            Update Your Travel Preferences
          </CardTitle>
          <CardDescription className="text-body-text text-base">
            Modify your preferences to get better AI-powered suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveChanges} className="space-y-8">
            {/* Question 1: Budget */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">What's your typical trip budget?</Label>
              <RadioGroup value={formData.budget} onValueChange={(value) => setFormData({ ...formData, budget: value })}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="economy" id="budget1" />
                  <Label htmlFor="budget1" className="font-normal cursor-pointer">Economy ($)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="budget2" />
                  <Label htmlFor="budget2" className="font-normal cursor-pointer">Standard ($$)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="premium" id="budget3" />
                  <Label htmlFor="premium3" className="font-normal cursor-pointer">Premium ($$$)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="luxury" id="budget4" />
                  <Label htmlFor="budget4" className="font-normal cursor-pointer">Luxury ($$$$)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question 2: Travel Style */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">What's your preferred travel style?</Label>
              <div className="space-y-2">
                {["Adventurous", "Relaxing", "Romantic", "Cultural", "Family-Friendly", "Luxurious", "Backpacking"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox 
                      id={option}
                      checked={formData.travelStyles.includes(option)}
                      onCheckedChange={() => handleCheckboxChange(option)}
                    />
                    <Label htmlFor={option} className="font-normal cursor-pointer">{option}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
