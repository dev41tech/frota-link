import { useState } from 'react';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2, ArrowUpDown } from 'lucide-react';

export function CompanySelector() {
  const { isMaster, currentCompany, availableCompanies, switchCompany } = useMultiTenant();
  const [isChanging, setIsChanging] = useState(false);

  if (!isMaster) return null;

  const handleCompanyChange = async (companyId: string) => {
    setIsChanging(true);
    try {
      await switchCompany(companyId);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg border">
      <Building2 className="h-5 w-5 text-primary" />
      
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">Empresa Ativa:</p>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="font-medium">
            Master
          </Badge>
          
          <Select 
            value={currentCompany?.id || 'all'} 
            onValueChange={handleCompanyChange}
            disabled={isChanging}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione uma empresa">
                {currentCompany?.name || 'Todas as empresas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {availableCompanies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {isChanging && (
            <ArrowUpDown className="h-4 w-4 animate-pulse text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}