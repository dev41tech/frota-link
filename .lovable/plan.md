
## Melhorar filtros e experiencia na tela de Solicitacoes de Frete

### Melhorias planejadas

1. **Filtro por periodo (data)** - Adicionar date range picker para filtrar solicitacoes por data de criacao
2. **Filtro por cliente** - Select com os clientes que possuem solicitacoes
3. **Contador de resultados** - Mostrar quantas solicitacoes estao sendo exibidas vs total
4. **Badge "rejected" no filtro de status** - Adicionar o status "Rejeitados" que esta faltando
5. **Barra de filtros reorganizada** - Agrupar busca textual, filtro de cliente e filtro de data em uma unica linha responsiva
6. **Botao de limpar filtros** - Exibido quando algum filtro esta ativo, reseta todos de uma vez
7. **Ordenacao** - Select para ordenar por data (mais recente/antigo) ou valor do frete

### Detalhes tecnicos

**Arquivo alterado:** `src/pages/FreightRequests.tsx`

**Novos states:**
- `dateRange: { from: Date | undefined; to: Date | undefined }` para filtro por periodo
- `clientFilter: string` (party_id ou 'all')
- `sortBy: string` ('newest' | 'oldest' | 'highest_value' | 'lowest_value')

**Filtro por cliente:**
- Extrair lista unica de clientes dos requests existentes (`party_id` + `party_name`)
- Usar componente Select do shadcn

**Filtro por data:**
- Usar Popover + Calendar do shadcn com mode="range"
- Filtrar pelo campo `created_at`

**Badge de status "Rejeitados":**
- Adicionar `{ key: 'rejected', label: 'Rejeitados', count: statusCounts['rejected'] || 0 }` na lista de filtros

**Ordenacao:**
- Aplicar sort no array `filtered` apos os filtros

**Botao limpar filtros:**
- Aparece quando qualquer filtro difere do padrao
- Reseta search, statusFilter, clientFilter, dateRange e sortBy

**Contador de resultados:**
- Texto simples: "Exibindo X de Y solicitacoes"

**Layout responsivo:**
- Filtros em `flex flex-wrap gap-3` para mobile
- Em desktop, filtros em linha unica
