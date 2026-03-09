import { useState } from 'react';
import { useJourneyProfitDetails, JourneyProfitDetail, JourneyFilter, ExpenseBreakdown } from '@/hooks/useJourneyProfitDetails';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/profitabilityCalculations';
import { formatDateBR } from '@/lib/utils';
import { JourneyDREModal } from './JourneyDREModal';
import { CouplingBadges } from './CouplingBadges';
import { IdleTrailersAlert } from './IdleTrailersAlert';
import {
  Trophy,
  AlertTriangle,
  Fuel,
  CircleDollarSign,
  Wrench,
  Bed,
  MoreHorizontal,
  Truck,
  User,
  Calendar,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';

export type ReportViewMode = 'competency' | 'journey';

interface JourneyProfitabilityDashboardProps {
  startDate?: Date;
  endDate?: Date;
  viewMode?: ReportViewMode;
}

// Cost bar colors
const COST_COLORS = {
  fuel: 'bg-blue-500',
  toll: 'bg-yellow-500',
  maintenance: 'bg-orange-500',
  lodging: 'bg-purple-500',
  other: 'bg-gray-400',
};

const COST_LABELS = {
  fuel: 'Combustível',
  toll: 'Pedágio',
  maintenance: 'Manutenção',
  lodging: 'Hospedagem',
  other: 'Outros',
};

const COST_ICONS = {
  fuel: Fuel,
  toll: CircleDollarSign,
  maintenance: Wrench,
  lodging: Bed,
  other: MoreHorizontal,
};

// Cost composition bar component
function CostCompositionBar({ breakdown, total }: { breakdown: ExpenseBreakdown; total: number }) {
  if (total === 0) return null;

  const segments = [
    { key: 'fuel', value: breakdown.fuel },
    { key: 'toll', value: breakdown.toll },
    { key: 'maintenance', value: breakdown.maintenance },
    { key: 'lodging', value: breakdown.lodging },
    { key: 'other', value: breakdown.other },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        {segments.map(segment => {
          const percentage = (segment.value / total) * 100;
          return (
            <div
              key={segment.key}
              className={`${COST_COLORS[segment.key as keyof typeof COST_COLORS]} transition-all`}
              style={{ width: `${percentage}%` }}
              title={`${COST_LABELS[segment.key as keyof typeof COST_LABELS]}: ${formatCurrency(segment.value)} (${percentage.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {segments.map(segment => {
          const Icon = COST_ICONS[segment.key as keyof typeof COST_ICONS];
          const percentage = ((segment.value / total) * 100).toFixed(0);
          return (
            <span key={segment.key} className="flex items-center gap-1 text-muted-foreground">
              <Icon className="h-3 w-3" />
              <span>{COST_LABELS[segment.key as keyof typeof COST_LABELS]}</span>
              <span className="font-medium">{percentage}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Insight badge component
function InsightBadge({ insight }: { insight: string }) {
  const getVariant = () => {
    if (insight.includes('Prejuízo')) return 'destructive';
    if (insight.includes('Crítica') || insight.includes('+')) return 'destructive';
    if (insight.includes('Alto') || insight.includes('Manutenção')) return 'secondary';
    return 'outline';
  };

  const getIcon = () => {
    if (insight.includes('Combustível')) return '⛽';
    if (insight.includes('Pedágio')) return '🚧';
    if (insight.includes('Pernoite')) return '🏨';
    if (insight.includes('Manutenção')) return '🔧';
    if (insight.includes('Receita')) return '📋';
    if (insight.includes('Crítica')) return '⚠️';
    if (insight.includes('Prejuízo')) return '🛑';
    return '💡';
  };

  return (
    <Badge variant={getVariant()} className="text-xs font-normal">
      {getIcon()} {insight}
    </Badge>
  );
}

// Journey card component
function JourneyCard({ detail, onClick }: { detail: JourneyProfitDetail; onClick: () => void }) {
  const isProfitable = detail.profit >= 0;

  return (
    <Card 
      className={`overflow-hidden transition-all hover:shadow-md cursor-pointer group ${!isProfitable ? 'border-destructive/30' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">
                {detail.journey.journey_number}: {detail.journey.origin} → {detail.journey.destination}
              </h3>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              {detail.journey.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDateBR(detail.journey.start_date)}
                </span>
              )}
              {detail.driver && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {detail.driver.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                {detail.vehicle.plate}
              </span>
              {/* Badges de carretas engatadas */}
              {detail.journey.coupling_id && (
                <CouplingBadges couplingId={detail.journey.coupling_id} compact />
              )}
            </div>
          </div>
          <div className={`text-right shrink-0`}>
            <div className={`text-lg font-bold ${isProfitable ? 'text-emerald-600' : 'text-destructive'}`}>
              {isProfitable ? '+' : ''}{formatCurrency(detail.profit)}
            </div>
            <div className={`text-xs font-medium ${isProfitable ? 'text-emerald-600' : 'text-destructive'}`}>
              {detail.margin.toFixed(1)}% margem
            </div>
          </div>
        </div>

        {/* Cost composition bar */}
        {detail.totalExpenses > 0 && (
          <CostCompositionBar breakdown={detail.expenseBreakdown} total={detail.totalExpenses} />
        )}

        {/* Insights */}
        {detail.insights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {detail.insights.map((insight, idx) => (
              <InsightBadge key={idx} insight={insight} />
            ))}
          </div>
        )}

        {/* Financial summary */}
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Receita: {formatCurrency(detail.revenue)}</span>
          <span>Despesas: {formatCurrency(detail.totalExpenses)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Hero card for MVP/Worst journey
function HeroCard({ 
  journey, 
  type 
}: { 
  journey: JourneyProfitDetail | null; 
  type: 'mvp' | 'attention' 
}) {
  const isMvp = type === 'mvp';
  
  if (!journey) {
    return (
      <Card className={`${isMvp ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
        <CardContent className="p-6 text-center text-muted-foreground">
          Nenhuma jornada encontrada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${isMvp ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            {isMvp ? (
              <div className="p-2 rounded-full bg-emerald-100">
                <Trophy className="h-5 w-5 text-emerald-600" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            )}
            <div>
              <h3 className={`font-semibold ${isMvp ? 'text-emerald-800' : 'text-red-800'}`}>
                {isMvp ? 'Jornada MVP' : 'Ponto de Atenção'}
              </h3>
              <p className={`text-xs ${isMvp ? 'text-emerald-600' : 'text-red-600'}`}>
                {isMvp ? 'Mais Lucrativa' : 'Menos Lucrativa'}
              </p>
            </div>
          </div>
          {isMvp ? (
            <TrendingUp className="h-8 w-8 text-emerald-300" />
          ) : (
            <TrendingDown className="h-8 w-8 text-red-300" />
          )}
        </div>

        <div className="space-y-2">
          <p className="font-medium text-foreground truncate">
            {journey.journey.journey_number}: {journey.journey.origin} → {journey.journey.destination}
          </p>
          <p className="text-sm text-muted-foreground">
            Veículo: {journey.vehicle.plate}
          </p>
          <div className={`text-2xl font-bold ${isMvp ? 'text-emerald-600' : 'text-red-600'}`}>
            {journey.profit >= 0 ? 'Lucro: ' : 'Prejuízo: '}{formatCurrency(Math.abs(journey.profit))}
          </div>
          <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${isMvp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            Margem: {journey.margin.toFixed(1)}%
          </div>

          {!isMvp && journey.mainOffender && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <span className="text-xs text-red-700 font-medium">
                🎯 Ofensor Principal: {journey.mainOffender}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Filter buttons
const FILTERS: { key: JourneyFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'loss', label: 'Com Prejuízo' },
  { key: 'low_margin', label: 'Baixa Margem' },
  { key: 'high_performance', label: 'Alta Performance' },
];

export function JourneyProfitabilityDashboard({ startDate, endDate, viewMode = 'competency' }: JourneyProfitabilityDashboardProps) {
  const { data, loading, mvpJourney, worstJourney, filterJourneys } = useJourneyProfitDetails(startDate, endDate, viewMode);
  const [activeFilter, setActiveFilter] = useState<JourneyFilter>('all');
  const [selectedJourney, setSelectedJourney] = useState<JourneyProfitDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredData = filterJourneys(activeFilter);

  const handleJourneyClick = (journey: JourneyProfitDetail) => {
    setSelectedJourney(journey);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="h-10 w-96 bg-muted animate-pulse rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhuma jornada concluída encontrada no período selecionado.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Alerta de Carretas Ociosas */}
        <IdleTrailersAlert startDate={startDate} endDate={endDate} threshold={20} />

        {/* Hero Section */}
        <div className="grid md:grid-cols-2 gap-4">
          <HeroCard journey={mvpJourney} type="mvp" />
          <HeroCard journey={worstJourney} type="attention" />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(filter => (
            <Button
              key={filter.key}
              variant={activeFilter === filter.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(filter.key)}
              className="text-xs"
            >
              {filter.label}
              {filter.key !== 'all' && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {filterJourneys(filter.key).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Journey List */}
        <div className="space-y-3">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma jornada encontrada com este filtro.
            </div>
          ) : (
            filteredData.map(detail => (
              <JourneyCard 
                key={detail.journey.id} 
                detail={detail} 
                onClick={() => handleJourneyClick(detail)}
              />
            ))
          )}
        </div>
      </div>

      {/* DRE Modal */}
      <JourneyDREModal
        journey={selectedJourney}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}
