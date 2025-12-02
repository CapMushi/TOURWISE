import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Minus, Plus } from "lucide-react";

export default function Booking() {
  const [seats, setSeats] = useState(1);
  const availableSeats = 12;
  const pricePerSeat = 250;

  const incrementSeats = () => {
    if (seats < availableSeats) {
      setSeats(seats + 1);
    }
  };

  const decrementSeats = () => {
    if (seats > 1) {
      setSeats(seats - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="glass-card border-0 max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Weekend Mountain Hiking Retreat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm text-body-text mb-1">Available Seats:</p>
            <p className="text-xl font-bold text-accent">{availableSeats} Seats Available</p>
          </div>

          <div>
            <label className="text-sm font-medium text-heading mb-3 block">
              Select Number of Seats:
            </label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={decrementSeats}
                disabled={seats <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-2xl font-bold w-12 text-center">{seats}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={incrementSeats}
                disabled={seats >= availableSeats}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm text-body-text mb-1">Total Price:</p>
            <p className="text-3xl font-bold text-primary">${seats * pricePerSeat}</p>
          </div>

          <Button className="w-full" size="lg">
            Pay by Card
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
