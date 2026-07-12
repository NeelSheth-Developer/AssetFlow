"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Package,
  ArrowLeftRight,
  Calendar,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Activity,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useUIStore } from "@/stores/ui-store";
import { NAV_ITEMS } from "@/lib/constants";
import { users } from "@/data/mock";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Package,
  ArrowLeftRight,
  Calendar,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Activity,
};

const actions = [
  { label: "Allocate Asset", icon: Plus, href: "/allocations" },
  { label: "New Booking", icon: Calendar, href: "/bookings" },
  { label: "Raise Maintenance", icon: Wrench, href: "/maintenance" },
];

const mockPeople = users.slice(0, 5);

export function CommandMenu() {
  const router = useRouter();
  const open = useUIStore((s) => s.commandMenuOpen);
  const setOpen = useUIStore((s) => s.setCommandMenuOpen);

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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

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
        <CommandGroup heading="Actions">
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

        <CommandSeparator />

        {/* People */}
        <CommandGroup heading="People">
          {mockPeople.map((person) => (
            <CommandItem
              key={person.id}
              onSelect={() => runCommand(() => router.push(`/organization`))}
            >
              <Users className="mr-2 h-4 w-4" />
              <span>{person.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {person.designation}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
