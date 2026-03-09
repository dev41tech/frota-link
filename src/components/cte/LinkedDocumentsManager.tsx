import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash, FileText, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export interface LinkedDocument {
  type: 'nfe' | 'cte';
  key: string;
  number: string;
  series: string;
  value?: number;
  issueDate?: string;
}

interface LinkedDocumentsManagerProps {
  documents: LinkedDocument[];
  onChange: (docs: LinkedDocument[]) => void;
  requiredTypes?: Array<'nfe' | 'cte'>;
  allowMultiple?: boolean;
  showValueFields?: boolean;
  operationType?: string;
}

export function LinkedDocumentsManager({
  documents,
  onChange,
  requiredTypes,
  allowMultiple = true,
  showValueFields = true,
  operationType
}: LinkedDocumentsManagerProps) {
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});

  const validateAccessKey = (key: string): boolean => {
    return /^\d{44}$/.test(key);
  };

  const handleAddDocument = () => {
    onChange([
      ...documents,
      {
        type: 'nfe',
        key: '',
        number: '',
        series: '',
      }
    ]);
  };

  const updateDocument = (index: number, field: keyof LinkedDocument, value: any) => {
    const updated = [...documents];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);

    // Validar chave de acesso quando alterada
    if (field === 'key') {
      const newErrors = { ...validationErrors };
      if (value && !validateAccessKey(value)) {
        newErrors[index] = 'Chave de acesso deve ter 44 dígitos numéricos';
      } else {
        delete newErrors[index];
      }
      setValidationErrors(newErrors);
    }
  };

  const removeDocument = (index: number) => {
    const updated = documents.filter((_, i) => i !== index);
    onChange(updated);
    
    // Remover erros de validação para este índice
    const newErrors = { ...validationErrors };
    delete newErrors[index];
    setValidationErrors(newErrors);
  };

  const getKeyValidationIcon = (key: string) => {
    if (!key) return null;
    if (validateAccessKey(key)) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const showRequiredAlert = 
    (operationType === 'subcontratacao' || operationType === 'redespacho') &&
    !documents.some(doc => doc.type === 'cte');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Documentos Fiscais Vinculados</h3>
        {allowMultiple && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddDocument}
            type="button"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Documento
          </Button>
        )}
      </div>

      {showRequiredAlert && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Para {operationType}, é <strong>obrigatório</strong> vincular o CT-e anterior
          </AlertDescription>
        </Alert>
      )}

      {documents.map((doc, index) => (
        <Card key={index} className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select
                value={doc.type}
                onValueChange={(value) => updateDocument(index, 'type', value as 'nfe' | 'cte')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nfe">NF-e (Nota Fiscal Eletrônica)</SelectItem>
                  <SelectItem value="cte">CT-e (Conhecimento de Transporte)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chave de Acesso (44 dígitos) *</Label>
              <div className="flex gap-2 items-center">
                <Input
                  value={doc.key}
                  onChange={(e) => updateDocument(index, 'key', e.target.value.replace(/\D/g, ''))}
                  placeholder="00000000000000000000000000000000000000000000"
                  maxLength={44}
                  className={`font-mono text-sm ${validationErrors[index] ? 'border-destructive' : ''}`}
                />
                {getKeyValidationIcon(doc.key)}
              </div>
              {validationErrors[index] && (
                <p className="text-xs text-destructive">{validationErrors[index]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Número</Label>
              <Input
                value={doc.number}
                onChange={(e) => updateDocument(index, 'number', e.target.value)}
                placeholder="12345"
              />
            </div>

            <div className="space-y-2">
              <Label>Série</Label>
              <Input
                value={doc.series}
                onChange={(e) => updateDocument(index, 'series', e.target.value)}
                placeholder="1"
              />
            </div>

            {doc.type === 'nfe' && showValueFields && (
              <>
                <div className="space-y-2">
                  <Label>Valor da NF-e (Opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={doc.value || ''}
                    onChange={(e) => updateDocument(index, 'value', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Emissão (Opcional)</Label>
                  <Input
                    type="date"
                    value={doc.issueDate || ''}
                    onChange={(e) => updateDocument(index, 'issueDate', e.target.value)}
                  />
                </div>
              </>
            )}

            <div className={`${doc.type === 'nfe' && showValueFields ? 'col-span-1 md:col-span-2' : 'col-span-1 md:col-span-2'} flex justify-end`}>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => removeDocument(index)}
                type="button"
              >
                <Trash className="h-4 w-4 mr-2" />
                Remover
              </Button>
            </div>
          </div>
        </Card>
      ))}

      {documents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="font-medium">Nenhum documento vinculado</p>
          <p className="text-sm">Clique em "Adicionar Documento" para vincular NF-e ou CT-e</p>
        </div>
      )}
    </div>
  );
}
