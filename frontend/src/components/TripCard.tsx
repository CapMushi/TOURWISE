import { Star, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPkr } from "@/lib/currency";

interface TripCardProps {
  image: string;
  title: string;
  destination: string;
  agent: string;
  price: number;
  rating: number;
  duration: string;
  onClick?: () => void;
}

export function TripCard({
  image,
  title,
  destination,
  agent,
  price,
  rating,
  duration,
  onClick
}: TripCardProps) {
  return (
    <div className="glass-card overflow-hidden cursor-pointer" onClick={onClick}>
      <div className="relative h-48 overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
        <div className="absolute top-2 right-2 bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-medium">
          {duration}
        </div>
      </div>
      
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading font-semibold text-lg text-heading line-clamp-1">
            {title}
          </h3>
          <div className="flex items-center gap-1 text-sm">
            <Star className="h-4 w-4 fill-accent text-accent" />
            <span className="font-medium">{rating}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-body-text text-sm">
          <MapPin className="h-4 w-4" />
          <span>{destination}</span>
        </div>

        <div className="text-sm text-body-text">
          by <span className="font-medium text-heading">{agent}</span>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <span className="text-2xl font-heading font-bold text-primary">
              {formatPkr(price)}
            </span>
            <span className="text-sm text-body-text"> /person (PKR)</span>
          </div>
          <Button size="sm" variant="outline">View Details</Button>
        </div>
      </div>
    </div>
  );
}
