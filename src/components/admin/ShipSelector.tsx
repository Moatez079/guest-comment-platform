import { Ship } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface ShipOption {
  id: string;
  name: string;
}

interface ShipSelectorProps {
  ships: ShipOption[];
  selectedShipId: string;
  onShipChange: (shipId: string) => void;
}

const ShipSelector = ({ ships, selectedShipId, onShipChange }: ShipSelectorProps) => {
  if (ships.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-muted/50 border border-border">
      <Ship className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-foreground shrink-0">Ship:</span>
      <Select value={selectedShipId} onValueChange={onShipChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select ship..." />
        </SelectTrigger>
        <SelectContent>
          {ships.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ShipSelector;
