"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Package, ArrowLeftRight, Repeat2,
  Calendar, Wrench, ClipboardCheck, BarChart3, Activity, Plus,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useUIStore } from "@/stores/ui-store";
import { NAV_ITEMS } from "@/lib/constants";
import { assetsApi } from "@/lib/api";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, Building2, Package, ArrowLeftRight, Repeat2,
  Calendar, Wrench, ClipboardCheck, BarChart3, Activity,
};

const actions = [
  { label: "Allocate Asset", icon: Plus, href: "/allocations" },
  { label: "New Booking", icon: Calendar, href: "/bookings" },
  { label: "Raise Maintenance", icon: Wrench, href: "/maintenance" },
  { label: "Request Transfer", icon: Repeat2, href: "/transfers" },
];

export function CommandMenu() {
  const router = useRouter();
  const open = useUIStore((s) => s.commandMenuOpen);
  const setOpen = useUIStore((s) => s.setCommandMenuOpen);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    },
    [open, setOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(() => {
      assetsApi.search(value)
        .then((res: any) => {
          if (res.success && res.data) setSearchResults(res.data.assets || []);
          else setSearchResults([]);
        })
        .catch(() => setSearchResults([]));
    }, 300);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search assets, pages, or actions..." onValueChange={handleSearch} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Asset search results */}
        {searchResults.length > 0 && (
          <CommandGroup heading="Assets">
            {searchResults.slice(0, 5).map((asset: any) => (
              <CommandItem
                key={asset.id}
                onSelect={() => runCommand(() => router.push("/assets"))}
              >
                <Package className="mr-2 h-4 w-4" />
                <span>{asset.name}</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">{asset.tag}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searchResults.length > 0 && <CommandSeparator />}

        {/* Pages */}
        <CommandGroup heading="Pages">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon];
            return (
              <CommandItem
                key={item.href}
                onSelect={() => runCommand(() => router.push(item.href))}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Actions */}
        <CommandGroup heading="Quick Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.label}
              onSelect={() => runCommand(() => router.push(action.href))}
            >
              <action.icon className="mr-2 h-4 w-4" />
              <span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
