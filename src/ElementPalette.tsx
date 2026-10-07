import { useState } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Plus, ChevronDown, Search } from "lucide-react";
import { PALETTE_GROUPS } from "./registry";
import { ELEMENT_ICONS } from "./elementIcons";
import { startPaletteDrag, endPaletteDrag } from "./dnd";
import type { Element } from "./model";

export function ElementPalette({
  add,
}: {
  add: (type: Element["type"], preset?: Partial<Element>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const groups = PALETTE_GROUPS.map((group) => ({
    ...group,
    entries: group.entries.filter((entry) =>
      `${entry.label} ${entry.description} ${group.title}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ),
  }));
  return (
    <Dropdown.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <Dropdown.Trigger className="add-button">
        <Plus size={16} />
        Add element
        <ChevronDown size={13} />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="dropdown element-palette"
          sideOffset={8}
          align="start"
        >
          <label className="palette-search">
            <Search size={15} aria-hidden="true" />
            <input
              autoFocus
              aria-label="Search elements"
              placeholder="Search elements…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  event.currentTarget
                    .closest('[role="menu"]')
                    ?.querySelector<HTMLElement>('[role="menuitem"]')
                    ?.focus();
                }
                if (event.key !== "Escape" && event.key !== "Tab")
                  event.stopPropagation();
              }}
            />
          </label>
          <div className="palette-results">
            {groups
              .filter((group) => group.entries.length)
              .map((group) => (
                <Dropdown.Group key={group.category}>
                  <Dropdown.Label className="dropdown-label">
                    {group.title}
                  </Dropdown.Label>
                  {group.entries.map((entry) => {
                    const Icon = ELEMENT_ICONS[entry.type];
                    return (
                      <Dropdown.Item
                        key={entry.id}
                        aria-label={entry.label}
                        textValue={entry.label}
                        onSelect={() => {
                          add(entry.type, entry.preset);
                          setOpen(false);
                          setQuery("");
                        }}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "application/x-vega-studio-element",
                            entry.id,
                          );
                          event.dataTransfer.effectAllowed = "copy";
                          startPaletteDrag(entry.type, entry.preset);
                        }}
                        onDragEnd={() => {
                          endPaletteDrag();
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="palette-icon">
                          <Icon size={18} />
                        </span>
                        <span>
                          <strong>{entry.label}</strong>
                          <small>{entry.description}</small>
                        </span>
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Group>
              ))}
            {!groups.some((group) => group.entries.length) && (
              <p className="palette-empty" role="status">
                No elements found. Try a different name.
              </p>
            )}
          </div>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
