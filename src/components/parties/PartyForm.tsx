import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import type { Party, PartyFormData } from "@/hooks/useParties";

interface PartyFormProps {
  party?: Party;
  type: 'customer' | 'supplier';
  onSubmit: (data: PartyFormData) => Promise<boolean>;
  onCancel: () => void;
  isLoading?: boolean;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 
  'SP', 'SE', 'TO'
];

export function PartyForm({ party, type, onSubmit, onCancel, isLoading }: PartyFormProps) {
  const [formData, setFormData] = useState<PartyFormData>({
    type,
    name: party?.name || '',
    document: party?.document || '',
    email: party?.email || '',
    phone: party?.phone || '',
    address_street: party?.address_street || '',
    address_number: party?.address_number || '',
    address_complement: party?.address_complement || '',
    address_district: party?.address_district || '',
    address_city: party?.address_city || '',
    address_state: party?.address_state || '',
    address_zip: party?.address_zip || '',
    ie: party?.ie || '',
    notes: party?.notes || '',
    is_active: party?.is_active ?? true,
  });

  const [isSearchingCep, setIsSearchingCep] = useState(false);

  const handleChange = (field: keyof PartyFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const searchCep = async () => {
    const cep = formData.address_zip?.replace(/\D/g, '');
    if (!cep || cep.length !== 8) {
      toast.error('CEP inválido');
      return;
    }

    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      setFormData(prev => ({
        ...prev,
        address_street: data.logradouro || prev.address_street,
        address_district: data.bairro || prev.address_district,
        address_city: data.localidade || prev.address_city,
        address_state: data.uf || prev.address_state,
      }));
      toast.success('Endereço preenchido');
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const success = await onSubmit(formData);
    if (success) {
      onCancel();
    }
  };

  const typeLabel = type === 'customer' ? 'Cliente' : 'Fornecedor';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Básicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Nome / Razão Social *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={`Nome do ${typeLabel.toLowerCase()}`}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document">CPF / CNPJ</Label>
              <Input
                id="document"
                value={formData.document}
                onChange={(e) => handleChange('document', e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ie">Inscrição Estadual</Label>
              <Input
                id="ie"
                value={formData.ie}
                onChange={(e) => handleChange('ie', e.target.value)}
                placeholder="Inscrição estadual"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Endereço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address_zip">CEP</Label>
              <div className="flex gap-2">
                <Input
                  id="address_zip"
                  value={formData.address_zip}
                  onChange={(e) => handleChange('address_zip', e.target.value)}
                  placeholder="00000-000"
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={searchCep}
                  disabled={isSearchingCep}
                >
                  {isSearchingCep ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address_street">Logradouro</Label>
              <Input
                id="address_street"
                value={formData.address_street}
                onChange={(e) => handleChange('address_street', e.target.value)}
                placeholder="Rua, Avenida, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_number">Número</Label>
              <Input
                id="address_number"
                value={formData.address_number}
                onChange={(e) => handleChange('address_number', e.target.value)}
                placeholder="123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_complement">Complemento</Label>
              <Input
                id="address_complement"
                value={formData.address_complement}
                onChange={(e) => handleChange('address_complement', e.target.value)}
                placeholder="Sala, Bloco, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_district">Bairro</Label>
              <Input
                id="address_district"
                value={formData.address_district}
                onChange={(e) => handleChange('address_district', e.target.value)}
                placeholder="Bairro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_city">Cidade</Label>
              <Input
                id="address_city"
                value={formData.address_city}
                onChange={(e) => handleChange('address_city', e.target.value)}
                placeholder="Cidade"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_state">UF</Label>
              <Select
                value={formData.address_state}
                onValueChange={(value) => handleChange('address_state', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Observações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Ativo</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleChange('is_active', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {party ? 'Atualizar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}
