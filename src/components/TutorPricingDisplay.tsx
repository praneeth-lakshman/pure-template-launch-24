
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface TutorPricingDisplayProps {
  examRates: Record<string, number>;
  compactMode?: boolean;
  highlightedExam?: string;
}

export const TutorPricingDisplay = ({ 
  examRates, 
  compactMode = false, 
  highlightedExam 
}: TutorPricingDisplayProps) => {
  const rates = Object.entries(examRates || {});
  
  if (rates.length === 0) {
    return (
      <div className="flex items-center gap-2 text-primary">
        <Clock className="h-4 w-4" />
        <span className="font-semibold">£30/hour</span>
      </div>
    );
  }

  // If only one rate and in compact mode, show it simply
  if (rates.length === 1 && compactMode) {
    const [exam, rate] = rates[0];
    return (
      <div className="flex items-center gap-2 text-primary">
        <Clock className="h-4 w-4" />
        <span className="font-semibold">£{rate}/hour</span>
        <Badge variant="outline" className="text-xs">
          {exam}
        </Badge>
      </div>
    );
  }

  // For single rate in full mode, show in card format
  if (rates.length === 1) {
    const [exam, rate] = rates[0];
  return (
    <Card className="p-3 bg-muted/30 min-h-[80px] flex flex-col">
      <div className="flex items-center gap-2 mb-2 text-primary">
        <Clock className="h-4 w-4" />
        <span className="font-semibold text-sm">Lesson Rates</span>
      </div>
      <div className="flex justify-between items-center text-sm flex-1">
        <span className="text-muted-foreground">{exam}</span>
        <span className="font-semibold">£{rate}/hour</span>
      </div>
    </Card>
  );
  }

  // For multiple rates, show them organized
  if (compactMode) {
    const minRate = Math.min(...rates.map(([_, rate]) => rate));
    const maxRate = Math.max(...rates.map(([_, rate]) => rate));
    
    return (
      <div className="flex items-center gap-2 text-primary">
        <Clock className="h-4 w-4" />
        <span className="font-semibold">
          {minRate === maxRate ? `£${minRate}/hour` : `£${minRate}-£${maxRate}/hour`}
        </span>
      </div>
    );
  }

  return (
    <Card className="p-3 bg-muted/30 min-h-[80px] flex flex-col">
      <div className="flex items-center gap-2 mb-2 text-primary">
        <Clock className="h-4 w-4" />
        <span className="font-semibold text-sm">Lesson Rates</span>
      </div>
      <div className="grid grid-cols-1 gap-1 flex-1">
        {rates.map(([exam, rate]) => (
          <div 
            key={exam} 
            className="flex justify-between items-center text-sm"
          >
            <span className="text-muted-foreground">{exam}</span>
            <span className="font-semibold">£{rate}/hour</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
