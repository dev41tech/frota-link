import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useParties, type Party } from "@/hooks/useParties";

interface PartySelectorProps {
  type: 'customer' | 'supplier';
  value?: string;
  onChange: (partyId: string | undefined, party?: Party) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowCreate?: boolean;
  onCreateNew?: () => void;
}

export function PartySelector({
  type,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  allowCreate = false,
  onCreateNew,
}: PartySelectorProps) {
  const [open, setOpen] = useState(false);
  const { parties, loading } = useParties(type);

  const activeParties = parties.filter(p => p.is_active);
  const selectedParty = activeParties.find(p => p.id === value);

  const defaultPlaceholder = type === 'customer' ? 'Selecione o cliente...' : 'Selecione o fornecedor...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled || loading}
        >
          {selectedParty ? (
            <span className="truncate">{selectedParty.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder || defaultPlaceholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${type === 'customer' ? 'cliente' : 'fornecedor'}...`} />
          <CommandList>
            <CommandEmpty>
              Nenhum {type === 'customer' ? 'cliente' : 'fornecedor'} encontrado.
            </CommandEmpty>
            <CommandGroup>
              {activeParties.map((party) => (
                <CommandItem
                  key={party.id}
                  value={party.name}
                  onSelect={() => {
                    onChange(party.id === value ? undefined : party.id, party);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === party.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{party.name}</span>
                    {party.document && (
                      <span className="text-xs text-muted-foreground">{party.document}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {allowCreate && onCreateNew && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onCreateNew();
                      setOpen(false);
                    }}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar novo {type === 'customer' ? 'cliente' : 'fornecedor'}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
