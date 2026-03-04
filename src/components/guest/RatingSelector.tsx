import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RatingSelectorProps {
  value: string | null;
  onChange: (val: string) => void;
  labels: { excellent: string; veryGood: string; good: string; fair: string };
}

const ratingOptions = [
  { key: "excellent", color: "bg-cruise-excellent text-white", hoverColor: "hover:bg-cruise-excellent/80" },
  { key: "veryGood", color: "bg-cruise-verygood text-white", hoverColor: "hover:bg-cruise-verygood/80" },
  { key: "good", color: "bg-cruise-good text-white", hoverColor: "hover:bg-cruise-good/80" },
  { key: "fair", color: "bg-cruise-fair text-white", hoverColor: "hover:bg-cruise-fair/80" },
] as const;

const RatingSelector = ({ value, onChange, labels }: RatingSelectorProps) => {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {ratingOptions.map((opt) => {
        const isSelected = value === opt.key;
        const label = labels[opt.key as keyof typeof labels];
        return (
          <motion.button
            key={opt.key}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(opt.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all border-2",
              isSelected
                ? `${opt.color} border-transparent shadow-md scale-105`
                : `bg-card border-border text-foreground ${opt.hoverColor} hover:text-white`
            )}
          >
            {label}
          </motion.button>
        );
      })}
    </div>
  );
};

export default RatingSelector;
