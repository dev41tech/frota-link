import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function CreateCompany() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    responsible_name: "",
    responsible_cpf: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    subscription_plan_id: "",
    vehicle_limit: "",
    contracted_price_per_vehicle: "",
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("monthly_price");
    
    setPlans(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("companies").insert([{
        name: formData.name,
        cnpj: formData.cnpj,
        email: formData.email || null,
        phone: formData.phone || null,
        responsible_name: formData.responsible_name,
        responsible_cpf: formData.responsible_cpf,
        address: formData.address,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        subscription_plan_id: formData.subscription_plan_id || null,
        vehicle_limit: formData.vehicle_limit ? parseInt(formData.vehicle_limit) : null,
        contracted_price_per_vehicle: formData.contracted_price_per_vehicle ? parseFloat(formData.contracted_price_per_vehicle) : null,
        status: "active",
        subscription_status: "active",
      }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso!",
      });

      navigate("/companies");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nova Empresa</h1>
        <p className="text-muted-foreground">Cadastre uma nova empresa no sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="responsible_name">Responsável *</Label>
                <Input
                  id="responsible_name"
                  value={formData.responsible_name}
                  onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsible_cpf">CPF do Responsável *</Label>
                <Input
                  id="responsible_cpf"
                  value={formData.responsible_cpf}
                  onChange={(e) => setFormData({ ...formData, responsible_cpf: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">CEP</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subscription_plan_id">Plano de Assinatura</Label>
                <Select
                  value={formData.subscription_plan_id}
                  onValueChange={(value) => {
                    const selectedPlan = plans.find(p => p.id === value);
                    setFormData({ 
                      ...formData, 
                      subscription_plan_id: value,
                      contracted_price_per_vehicle: selectedPlan?.price_per_vehicle?.toString() || selectedPlan?.monthly_price?.toString() || ""
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contracted_price_per_vehicle">Valor por Placa (R$)</Label>
                <Input
                  id="contracted_price_per_vehicle"
                  type="number"
                  step="0.01"
                  value={formData.contracted_price_per_vehicle}
                  onChange={(e) => setFormData({ ...formData, contracted_price_per_vehicle: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_limit">Limite de Veículos</Label>
                <Input
                  id="vehicle_limit"
                  type="number"
                  value={formData.vehicle_limit}
                  onChange={(e) => setFormData({ ...formData, vehicle_limit: e.target.value })}
                  placeholder="Quantidade de placas"
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Total Mensal</Label>
                <div className="h-10 px-3 py-2 bg-muted rounded-md text-lg font-semibold flex items-center">
                  R$ {((parseFloat(formData.contracted_price_per_vehicle) || 0) * (parseInt(formData.vehicle_limit) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={() => navigate("/companies")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Criando..." : "Criar Empresa"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
