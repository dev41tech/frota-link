import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Power, PowerOff } from "lucide-react";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { useRevenueCategories } from "@/hooks/useRevenueCategories";
import { CategoryBadge } from "@/components/categories/CategoryBadge";
import { CategoryForm } from "@/components/categories/CategoryForm";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Categories() {
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [revenueFormOpen, setRevenueFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [categoryToToggle, setCategoryToToggle] = useState<any>(null);

  const { data: expenseCategories, refetch: refetchExpenses } = useExpenseCategories(undefined, false);
  const { data: revenueCategories, refetch: refetchRevenues } = useRevenueCategories(false);

  const handleEdit = (category: any, type: 'expense' | 'revenue') => {
    setSelectedCategory({ ...category, type });
    if (type === 'expense') {
      setExpenseFormOpen(true);
    } else {
      setRevenueFormOpen(true);
    }
  };

  const handleToggleActive = async () => {
    if (!categoryToToggle) return;

    try {
      const table = categoryToToggle.type === 'expense' ? 'expense_categories' : 'revenue_categories';
      const { error } = await supabase
        .from(table)
        .update({ is_active: !categoryToToggle.is_active })
        .eq('id', categoryToToggle.id);

      if (error) throw error;

      toast.success(categoryToToggle.is_active ? 'Categoria desativada' : 'Categoria ativada');
      if (categoryToToggle.type === 'expense') {
        refetchExpenses();
      } else {
        refetchRevenues();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCategoryToToggle(null);
    }
  };

  const renderCategoryList = (categories: any[], type: 'expense' | 'revenue') => {
    return (
      <div className="space-y-3">
        {categories?.map((category) => (
          <Card key={category.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <CategoryBadge
                  name={category.name}
                  icon={category.icon}
                  color={category.color}
                  classification={category.classification}
                  showClassification={type === 'expense'}
                />
                {category.is_system && (
                  <Badge variant="outline" className="text-xs">
                    Sistema
                  </Badge>
                )}
                {!category.is_active && (
                  <Badge variant="secondary" className="text-xs">
                    Inativa
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(category, type)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCategoryToToggle({ ...category, type })}
                >
                  {category.is_active ? (
                    <PowerOff className="h-4 w-4" />
                  ) : (
                    <Power className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Categorias</h1>
          <p className="text-muted-foreground">
            Gerencie as categorias de despesas e receitas da sua empresa
          </p>
        </div>

        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="expenses">Despesas</TabsTrigger>
            <TabsTrigger value="revenues">Receitas</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Categorias de Despesas</CardTitle>
                    <CardDescription>
                      Despesas diretas são vinculadas a viagens. Despesas indiretas são administrativas/fixas.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedCategory(null);
                      setExpenseFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Despesa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {renderCategoryList(expenseCategories || [], 'expense')}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenues" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Categorias de Receitas</CardTitle>
                    <CardDescription>
                      Gerencie as categorias de receita da sua empresa
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedCategory(null);
                      setRevenueFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Receita
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {renderCategoryList(revenueCategories || [], 'revenue')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      
        <CategoryForm
          open={expenseFormOpen}
          onOpenChange={setExpenseFormOpen}
          type="expense"
          category={selectedCategory?.type === 'expense' ? selectedCategory : null}
          onSuccess={() => {
            refetchExpenses();
            setSelectedCategory(null);
          }}
        />

        <CategoryForm
          open={revenueFormOpen}
          onOpenChange={setRevenueFormOpen}
          type="revenue"
          category={selectedCategory?.type === 'revenue' ? selectedCategory : null}
          onSuccess={() => {
            refetchRevenues();
            setSelectedCategory(null);
          }}
        />

        <AlertDialog open={!!categoryToToggle} onOpenChange={() => setCategoryToToggle(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {categoryToToggle?.is_active ? 'Desativar' : 'Ativar'} categoria?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {categoryToToggle?.is_active
                  ? 'A categoria será ocultada dos formulários, mas os lançamentos existentes serão preservados.'
                  : 'A categoria voltará a aparecer nos formulários de lançamento.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleToggleActive}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
