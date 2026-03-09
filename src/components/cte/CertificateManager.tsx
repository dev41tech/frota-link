import { useState, useEffect } from 'react';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertTriangle, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Certificate {
  id: string;
  certificate_name: string;
  expires_at: string;
  status: string;
  uploaded_at: string;
}

interface FiscalStatus {
  isConfigured: boolean;
  nuvemFiscalCompanyId: string | null;
}

export function CertificateManager() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [fiscalStatus, setFiscalStatus] = useState<FiscalStatus>({ isConfigured: false, nuvemFiscalCompanyId: null });
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();

  useEffect(() => {
    if (currentCompany) {
      fetchCertificates();
      fetchFiscalStatus();
    }
  }, [currentCompany]);

  const fetchCertificates = async () => {
    try {
      if (!currentCompany) return;

      const { data, error } = await supabase
        .from('digital_certificates')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar certificados",
        variant: "destructive",
      });
    }
  };

  const fetchFiscalStatus = async () => {
    try {
      if (!currentCompany) return;

      const { data, error } = await supabase
        .from('cte_settings')
        .select('nuvem_fiscal_company_id')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setFiscalStatus({
        isConfigured: !!data?.nuvem_fiscal_company_id,
        nuvemFiscalCompanyId: data?.nuvem_fiscal_company_id || null,
      });
    } catch (error) {
      console.error('Error fetching fiscal status:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['.p12', '.pfx'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!validTypes.includes(fileExtension)) {
        toast({
          title: "Erro",
          description: "Tipo de arquivo inválido. Selecione um arquivo .p12 ou .pfx",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !password) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo e informe a senha",
        variant: "destructive",
      });
      return;
    }

    if (!currentCompany) {
      toast({
        title: "Erro",
        description: "Empresa não selecionada",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      // Convert file to base64
      const fileBuffer = await selectedFile.arrayBuffer();
      const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

      // Step 1: Register/update company in Nuvem Fiscal automatically
      toast({
        title: "Configurando emissão fiscal...",
        description: "Aguarde enquanto configuramos a integração",
      });

      const { data: registerData, error: registerError } = await supabase.functions.invoke('nuvem-fiscal-register-company', {
        body: {
          companyId: currentCompany.id,
          cnpj: currentCompany.cnpj,
          razaoSocial: currentCompany.name,
          endereco: {
            logradouro: currentCompany.address || '',
            cidade: currentCompany.city || '',
            uf: currentCompany.state || '',
            cep: currentCompany.zip_code || '',
          },
          certificateContent: base64File,
          certificatePassword: password,
        }
      });

      if (registerError) {
        console.error('Error registering company:', registerError);
        throw registerError;
      }

      console.log('Company registered in Nuvem Fiscal:', registerData);

      // Step 2: Upload certificate to Nuvem Fiscal
      const { data, error } = await supabase.functions.invoke('certificate-upload', {
        body: {
          companyId: currentCompany.id,
          fileName: selectedFile.name,
          fileContent: base64File,
          password: password,
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Certificado enviado e emissão fiscal habilitada!",
      });

      // Reset form
      setSelectedFile(null);
      setPassword('');
      const fileInput = document.getElementById('certificate-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Refresh certificates list and fiscal status
      fetchCertificates();
      fetchFiscalStatus();
    } catch (error: any) {
      console.error('Error uploading certificate:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao enviar certificado",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (certificateId: string) => {
    try {
      const { error } = await supabase
        .from('digital_certificates')
        .delete()
        .eq('id', certificateId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Certificado removido com sucesso",
      });

      fetchCertificates();
    } catch (error) {
      console.error('Error deleting certificate:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover certificado",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (status === 'expired' || daysUntilExpiry <= 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expirado
        </Badge>
      );
    } else if (daysUntilExpiry <= 30) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expira em {daysUntilExpiry} dias
        </Badge>
      );
    } else if (daysUntilExpiry <= 60) {
      return (
        <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expira em {daysUntilExpiry} dias
        </Badge>
      );
    } else if (status === 'active') {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Ativo
        </Badge>
      );
    } else {
      return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getExpiryWarning = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) {
      return { type: 'expired', message: '🔴 Certificado expirado! Renovação urgente necessária.' };
    } else if (daysUntilExpiry <= 30) {
      return { type: 'critical', message: `⚠️ Expira em ${daysUntilExpiry} dias! Providencie a renovação.` };
    } else if (daysUntilExpiry <= 60) {
      return { type: 'warning', message: `⚠️ Expira em ${daysUntilExpiry} dias. Considere renovar em breve.` };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Fiscal Status Indicator */}
      <div className="flex items-center gap-2">
        {fiscalStatus.isConfigured ? (
          <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-3 w-3" />
            Emissão fiscal habilitada
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Configure o certificado digital para habilitar emissão
          </Badge>
        )}
      </div>

      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Os certificados digitais são necessários para emissão de CT-e.
          Ao enviar o certificado, a integração fiscal será configurada automaticamente.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Enviar Certificado Digital</CardTitle>
          <CardDescription>
            Faça upload do seu certificado digital (arquivo .p12 ou .pfx)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="certificate-file">Arquivo do Certificado</Label>
            <Input
              id="certificate-file"
              type="file"
              accept=".p12,.pfx"
              onChange={handleFileSelect}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: {selectedFile.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="certificate-password">Senha do Certificado</Label>
            <Input
              id="certificate-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha do certificado"
            />
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || !password || uploading}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Configurando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Enviar Certificado
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certificados Cadastrados</CardTitle>
          <CardDescription>
            Lista de certificados digitais disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {certificates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum certificado cadastrado
            </div>
          ) : (
            <div className="space-y-4">
              {/* Show expiry warnings */}
              {certificates.map((cert) => {
                const warning = getExpiryWarning(cert.expires_at);
                if (!warning) return null;

                return (
                  <Alert key={`warning-${cert.id}`} variant={warning.type === 'expired' ? 'destructive' : 'default'}>
                    {warning.type === 'expired' ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      <strong>{cert.certificate_name}</strong>: {warning.message}
                    </AlertDescription>
                  </Alert>
                );
              })}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data de Expiração</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certificates.map((cert) => (
                      <TableRow key={cert.id}>
                        <TableCell className="font-medium">
                          {cert.certificate_name}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(cert.status, cert.expires_at)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(cert.expires_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(cert.uploaded_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cert.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}