import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/categories/CategoryBadge";
import { X, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CategoryFilterProps {
  title: string;
  categories: any[];
  selectedCategories: string[];
  onSelectionChange: (selected: string[]) => void;
  type: 'revenue' | 'expense';
}

export function CategoryFilter({
  title,
  categories,
  selectedCategories,
  onSelectionChange,
  type
}: CategoryFilterProps) {
  const toggleCategory = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onSelectionChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      onSelectionChange([...selectedCategories, categoryId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(categories.map(c => c.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="h-4 w-4 mr-2" />
              {selectedCategories.length > 0 
                ? `${selectedCategories.length} selecionadas` 
                : 'Todas'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Filtrar Categorias</h4>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    Todas
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    Limpar
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center space-x-2 p-2 hover:bg-muted rounded-lg cursor-pointer"
                      onClick={() => toggleCategory(category.id)}
                    >
                      <Checkbox
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => toggleCategory(category.id)}
                      />
                      <CategoryBadge
                        name={category.name}
                        icon={category.icon}
                        color={category.color}
                        classification={category.classification}
                        showClassification={type === 'expense'}
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Badges das categorias selecionadas */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCategories.map((categoryId) => {
            const category = categories.find(c => c.id === categoryId);
            if (!category) return null;
            return (
              <Badge
                key={categoryId}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => toggleCategory(categoryId)}
              >
                {category.name}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
