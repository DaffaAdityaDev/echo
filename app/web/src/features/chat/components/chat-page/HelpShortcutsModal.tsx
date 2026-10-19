"use client";

import { Kbd } from "@/components/ui/Kbd";
import { Modal } from "@/components/ui/Modal";

interface HelpShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { action: "Toggle Debug Drawer", keys: "Ctrl + `" },
  { action: "Send Message", keys: "Enter" },
  { action: "New Line in Message", keys: "Shift + Enter" },
  { action: "Search Sessions", keys: "⌘K / Ctrl+K" },
  { action: "Close Modal", keys: "Esc" },
] as const;

export function HelpShortcutsModal({ isOpen, onClose }: HelpShortcutsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Help & Keyboard Shortcuts"
      description="Quick guide to operating the Echo AI Harness Platform."
    >
      <dl className="text-xs text-foreground divide-y divide-border">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.action} className="flex items-center justify-between gap-4 py-2.5">
            <dt>{shortcut.action}</dt>
            <dd>
              <Kbd>{shortcut.keys}</Kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
