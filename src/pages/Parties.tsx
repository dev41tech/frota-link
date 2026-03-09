import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useParties, type Party, type PartyFormData } from "@/hooks/useParties";
import { useCustomerPortalTokens } from "@/hooks/useCustomerPortalTokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { PartyForm } from "@/components/parties/PartyForm";
import { GeneratePortalLinkDialog } from "@/components/parties/GeneratePortalLinkDialog";
import { Users, Building2, Plus, Search, MoreVertical, Pencil, Trash2, CheckCircle, XCircle, Link2 } from "lucide-react";

export default function Parties() {
  const { parties, loading, createParty, updateParty, deleteParty, toggleActive, refetch } = useParties();
  const { tokens, generateToken, toggleToken, getTokenForParty, getPortalUrl } = useCustomerPortalTokens();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>(
    searchParams.get('tab') === 'supplier' ? 'supplier' : 'customer'
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [deletingParty, setDeletingParty] = useState<Party | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [portalParty, setPortalParty] = useState<Party | null>(null);

  const filteredParties = parties.filter(p => {
    const matchesType = p.type === activeTab;
    const matchesSearch = searchTerm === "" || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.document?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleSubmit = async (data: PartyFormData): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      if (editingParty) {
        const success = await updateParty(editingParty.id, data);
        if (success) {
          setEditingParty(null);
          setShowForm(false);
        }
        return success;
      } else {
        const created = await createParty(data);
        if (created) {
          setShowForm(false);
        }
        return !!created;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingParty) return;
    await deleteParty(deletingParty.id);
    setDeletingParty(null);
  };

  const handleEdit = (party: Party) => {
    setEditingParty(party);
    setShowForm(true);
  };

  const handleNewParty = () => {
    setEditingParty(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingParty(null);
  };

  const typeLabel = activeTab === 'customer' ? 'Cliente' : 'Fornecedor';
  const typeLabelPlural = activeTab === 'customer' ? 'Clientes' : 'Fornecedores';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes e Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie seus parceiros comerciais</p>
        </div>
        <Button onClick={handleNewParty}>
          <Plus className="mr-2 h-4 w-4" />
          Novo {typeLabel}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'customer' | 'supplier')}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="customer" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes
              <Badge variant="secondary" className="ml-1">
                {parties.filter(p => p.type === 'customer').length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="supplier" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Fornecedores
              <Badge variant="secondary" className="ml-1">
                {parties.filter(p => p.type === 'supplier').length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Buscar ${typeLabelPlural.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value="customer" className="mt-6">
          <PartiesTable
            parties={filteredParties}
            loading={loading}
            onEdit={handleEdit}
            onDelete={setDeletingParty}
            onToggleActive={toggleActive}
            onPortalLink={setPortalParty}
            emptyMessage="Nenhum cliente cadastrado"
            showPortalLink={true}
          />
        </TabsContent>

        <TabsContent value="supplier" className="mt-6">
          <PartiesTable
            parties={filteredParties}
            loading={loading}
            onEdit={handleEdit}
            onDelete={setDeletingParty}
            onToggleActive={toggleActive}
            onPortalLink={setPortalParty}
            emptyMessage="Nenhum fornecedor cadastrado"
            showPortalLink={false}
          />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingParty ? `Editar ${typeLabel}` : `Novo ${typeLabel}`}
            </DialogTitle>
          </DialogHeader>
          <PartyForm
            party={editingParty || undefined}
            type={activeTab}
            onSubmit={handleSubmit}
            onCancel={handleCloseForm}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        open={!!deletingParty}
        onOpenChange={() => setDeletingParty(null)}
        onConfirm={handleDelete}
        title={`Excluir ${deletingParty?.type === 'customer' ? 'Cliente' : 'Fornecedor'}`}
        description={`Tem certeza que deseja excluir "${deletingParty?.name}"? Esta ação não pode ser desfeita.`}
      />

      {/* Portal Link Dialog */}
      <GeneratePortalLinkDialog
        open={!!portalParty}
        onOpenChange={() => setPortalParty(null)}
        partyName={portalParty?.name || ''}
        partyId={portalParty?.id || ''}
        existingToken={portalParty ? getTokenForParty(portalParty.id) : undefined}
        onGenerate={generateToken}
        onToggle={toggleToken}
        getPortalUrl={getPortalUrl}
      />
    </div>
  );
}

// Sub-componente de tabela
interface PartiesTableProps {
  parties: Party[];
  loading: boolean;
  onEdit: (party: Party) => void;
  onDelete: (party: Party) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onPortalLink?: (party: Party) => void;
  emptyMessage: string;
  showPortalLink?: boolean;
}

function PartiesTable({ parties, loading, onEdit, onDelete, onToggleActive, onPortalLink, emptyMessage, showPortalLink }: PartiesTableProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (parties.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.map((party) => (
              <TableRow key={party.id}>
                <TableCell>
                  <div className="font-medium">{party.name}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {party.document || '-'}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {party.email && <div className="text-sm">{party.email}</div>}
                    {party.phone && <div className="text-sm text-muted-foreground">{party.phone}</div>}
                    {!party.email && !party.phone && <span className="text-muted-foreground">-</span>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {party.address_city && party.address_state 
                    ? `${party.address_city}/${party.address_state}` 
                    : party.address_city || party.address_state || '-'}
                </TableCell>
                <TableCell className="text-center">
                  {party.is_active ? (
                    <Badge variant="default" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Inativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(party)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {showPortalLink && onPortalLink && (
                        <DropdownMenuItem onClick={() => onPortalLink(party)}>
                          <Link2 className="h-4 w-4 mr-2" />
                          Link do Portal
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onToggleActive(party.id, !party.is_active)}>
                        {party.is_active ? (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(party)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
