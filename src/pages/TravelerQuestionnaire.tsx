import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function TravelerQuestionnaire() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    budget: "",
    travelStyles: [] as string[]
  });

  const handleCheckboxChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      travelStyles: prev.travelStyles.includes(value) 
        ? prev.travelStyles.filter(item => item !== value)
        : [...prev.travelStyles, value]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save preferences (in a real app, this would save to backend)
    navigate("/");
  };

  const handleSkip = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="glass-panel max-w-2xl w-full border-0">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-3xl mb-2">
            Help us personalize your recommendations!
          </CardTitle>
          <CardDescription className="text-body-text text-base">
            Answer a couple of questions (or skip) to fuel our AI-powered suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
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
                  <Label htmlFor="budget3" className="font-normal cursor-pointer">Premium ($$$)</Label>
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

            <div className="flex gap-4">
              <Button type="submit" className="flex-1">
                Submit
              </Button>
              <Button type="button" variant="secondary" onClick={handleSkip} className="flex-1">
                Skip
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
