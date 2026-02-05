'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Home,
  Percent,
  FileText,
  Filter
} from 'lucide-react';

interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'payout';
  description: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'processing';
  propertyName?: string;
  guestName?: string;
}

interface FinanceStats {
  currentBalance: number;
  monthlyEarnings: number;
  earningsGrowth: number;
  totalPayouts: number;
  pendingPayouts: number;
  nextPayout: {
    amount: number;
    date: string;
  };
}

interface HostFinancesProps {
  stats: FinanceStats;
  transactions: Transaction[];
  monthlyData?: {
    month: string;
    earnings: number;
    expenses: number;
  }[];
}

export default function HostFinances({ stats, transactions, monthlyData }: HostFinancesProps) {
  const incomeTransactions = transactions.filter(t => t.type === 'income');
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const payoutTransactions = transactions.filter(t => t.type === 'payout');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Finanzas
            </h1>
            <p className="text-slate-600 text-lg">
              Gestiona tus ingresos y pagos
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl border-slate-200 hover:bg-slate-50">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
            <Button className="rounded-xl bg-slate-900 hover:bg-slate-800">
              <Download className="w-4 h-4 mr-2" />
              Descargar reporte
            </Button>
          </div>
        </div>

        {/* Main Financial KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 border-slate-200 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur">
                  <DollarSign className="w-5 h-5" />
                </div>
                <Badge className="bg-white/20 text-white border-white/30">
                  Este mes
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-100">Ganancias</p>
                <p className="text-3xl font-bold mt-1">
                  ${stats.monthlyEarnings.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {stats.earningsGrowth >= 0 ? (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">+{stats.earningsGrowth}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-sm font-medium">{stats.earningsGrowth}%</span>
                  </>
                )}
                <span className="text-xs text-emerald-100">vs mes anterior</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-slate-200 bg-white shadow-lg hover:shadow-xl transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                  Disponible
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Balance actual</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  ${stats.currentBalance.toLocaleString()}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="w-full justify-between px-0 h-auto text-blue-600 hover:text-blue-700">
                <span className="text-xs font-medium">Solicitar pago</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>

          <Card className="p-6 border-slate-200 bg-white shadow-lg hover:shadow-xl transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-violet-50 rounded-xl">
                  <Clock className="w-5 h-5 text-violet-600" />
                </div>
                <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200">
                  Próximo
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Pago programado</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  ${stats.nextPayout.amount.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{stats.nextPayout.date}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-slate-200 bg-white shadow-lg hover:shadow-xl transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-amber-600" />
                </div>
                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                  Total
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Pagos realizados</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  ${stats.totalPayouts.toLocaleString()}
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {stats.pendingPayouts > 0 && `${stats.pendingPayouts} pendiente(s)`}
              </div>
            </div>
          </Card>
        </div>

        {/* Monthly Performance Chart */}
        {monthlyData && monthlyData.length > 0 && (
          <Card className="p-6 border-slate-200 bg-white shadow-lg">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Rendimiento mensual</h3>
                  <p className="text-sm text-slate-600 mt-1">Ingresos vs gastos</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl border-slate-200">
                  <FileText className="w-4 h-4 mr-2" />
                  Ver detalle
                </Button>
              </div>
              
              {/* Simple Bar Chart Representation */}
              <div className="space-y-4">
                {monthlyData.map((data, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{data.month}</span>
                      <div className="flex gap-4">
                        <span className="text-emerald-600 font-semibold">
                          ${data.earnings.toLocaleString()}
                        </span>
                        {data.expenses > 0 && (
                          <span className="text-red-600 font-semibold">
                            -${data.expenses.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 h-8">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-end px-3 text-white text-xs font-medium transition-all duration-500"
                        style={{ 
                          width: `${(data.earnings / Math.max(...monthlyData.map(d => d.earnings))) * 100}%` 
                        }}
                      >
                        Ingresos
                      </div>
                      {data.expenses > 0 && (
                        <div 
                          className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-end px-3 text-white text-xs font-medium transition-all duration-500"
                          style={{ 
                            width: `${(data.expenses / Math.max(...monthlyData.map(d => d.earnings))) * 30}%` 
                          }}
                        >
                          Gastos
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Transactions Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-slate-100/80 p-1.5 h-auto rounded-2xl border border-slate-200 shadow-sm">
            <TabsTrigger 
              value="all" 
              className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
            >
              <FileText className="w-4 h-4 mr-2" />
              Todas ({transactions.length})
            </TabsTrigger>
            <TabsTrigger 
              value="income" 
              className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Ingresos ({incomeTransactions.length})
            </TabsTrigger>
            <TabsTrigger 
              value="payouts" 
              className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Pagos ({payoutTransactions.length})
            </TabsTrigger>
            {expenseTransactions.length > 0 && (
              <TabsTrigger 
                value="expenses" 
                className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
              >
                <ArrowDownRight className="w-4 h-4 mr-2" />
                Gastos ({expenseTransactions.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all" className="space-y-3 mt-6">
            {transactions.length === 0 ? (
              <EmptyState 
                icon={<FileText className="w-12 h-12" />}
                title="No hay transacciones"
                description="Tus movimientos aparecerán aquí"
              />
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="income" className="space-y-3 mt-6">
            {incomeTransactions.length === 0 ? (
              <EmptyState 
                icon={<ArrowUpRight className="w-12 h-12" />}
                title="No hay ingresos registrados"
                description="Tus ingresos aparecerán aquí"
              />
            ) : (
              <div className="space-y-3">
                {incomeTransactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payouts" className="space-y-3 mt-6">
            {payoutTransactions.length === 0 ? (
              <EmptyState 
                icon={<CreditCard className="w-12 h-12" />}
                title="No hay pagos realizados"
                description="Tus pagos aparecerán aquí"
              />
            ) : (
              <div className="space-y-3">
                {payoutTransactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </div>
            )}
          </TabsContent>

          {expenseTransactions.length > 0 && (
            <TabsContent value="expenses" className="space-y-3 mt-6">
              <div className="space-y-3">
                {expenseTransactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>

      </div>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const typeConfig = {
    income: { 
      icon: <ArrowUpRight className="w-4 h-4" />,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      amountColor: 'text-emerald-600'
    },
    expense: { 
      icon: <ArrowDownRight className="w-4 h-4" />,
      color: 'bg-red-50 text-red-600 border-red-200',
      amountColor: 'text-red-600'
    },
    payout: { 
      icon: <CreditCard className="w-4 h-4" />,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      amountColor: 'text-blue-600'
    },
  }[transaction.type];

  const statusConfig = {
    completed: { label: 'Completado', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
    pending: { label: 'Pendiente', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
    processing: { label: 'Procesando', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  }[transaction.status];

  return (
    <Card className="p-4 border-slate-200 hover:shadow-md transition-all bg-white">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className={`p-3 rounded-xl border ${typeConfig.color}`}>
            {typeConfig.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 mb-0.5 truncate">
              {transaction.description}
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{transaction.date}</span>
              {transaction.propertyName && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Home className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[200px]">{transaction.propertyName}</span>
                  </div>
                </>
              )}
              {transaction.guestName && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[150px]">{transaction.guestName}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge className={`${statusConfig.color} border`}>
            {statusConfig.label}
          </Badge>
          <p className={`text-xl font-bold ${typeConfig.amountColor} min-w-[120px] text-right`}>
            {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString()}
          </p>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
}) {
  return (
    <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-slate-50/50">
      <div className="flex flex-col items-center max-w-md mx-auto space-y-4">
        <div className="p-4 bg-white rounded-2xl text-slate-400 shadow-sm">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="text-slate-600">{description}</p>
        </div>
      </div>
    </Card>
  );
}
