import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface MobileNavItem {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}

interface MobileNavProps {
  brandIcon: React.ElementType;
  brandName: string;
  brandSub: string;
  items: MobileNavItem[];
  bottomItems?: MobileNavItem[];
}

const MobileNav = ({ brandIcon: BrandIcon, brandName, brandSub, items, bottomItems }: MobileNavProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <BrandIcon className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <div>
          <div className="font-display font-bold text-sm text-sidebar-foreground">{brandName}</div>
          <div className="text-xs text-sidebar-foreground/60">{brandSub}</div>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="text-sidebar-foreground">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-sidebar text-sidebar-foreground p-0">
          <div className="p-5 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <BrandIcon className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <div className="font-display font-bold text-sm">{brandName}</div>
                <div className="text-xs text-sidebar-foreground/60">{brandSub}</div>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => { item.onClick(); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                } ${item.className || ""}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
          {bottomItems && bottomItems.length > 0 && (
            <div className="p-3 border-t border-sidebar-border space-y-1">
              {bottomItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => { item.onClick(); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors ${item.className || ""}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MobileNav;
