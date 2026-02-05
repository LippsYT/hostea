'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  FileText,
  Filter,
  Home
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/10">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Finanzas</h1>
            <p className="text-lg text-slate-600">Gestiona tus ingresos y pagos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl border-slate-200 hover:bg-slate-50">
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
            <Button className="rounded-xl bg-slate-900 hover:bg-slate-800">
              <Download className="mr-2 h-4 w-4" />
              Descargar reporte
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur">
                  <DollarSign className="h-5 w-5" />
                </div>
                <Badge className="border-white/30 bg-white/20 text-white">Este mes</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-100">Ganancias</p>
                <p className="mt-1 text-3xl font-bold">${stats.monthlyEarnings.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {stats.earningsGrowth >= 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">+{stats.earningsGrowth}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-medium">{stats.earningsGrowth}%</span>
                  </>
                )}
                <span className="text-xs text-emerald-100">vs mes anterior</span>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-6 shadow-lg transition-all hover:shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-blue-50 p-2.5">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <Badge className="border-blue-200 bg-blue-50 text-blue-700">Disponible</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Balance actual</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">${stats.currentBalance.toLocaleString()}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-auto w-full justify-between px-0 text-blue-600 hover:text-blue-700">
                <span className="text-xs font-medium">Solicitar pago</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-6 shadow-lg transition-all hover:shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-violet-50 p-2.5">
                  <Clock className="h-5 w-5 text-violet-600" />
                </div>
                <Badge className="border-violet-200 bg-violet-50 text-violet-700">Próximo</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Pago programado</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">${stats.nextPayout.amount.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                <span>{stats.nextPayout.date}</span>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-6 shadow-lg transition-all hover:shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-amber-50 p-2.5">
                  <CheckCircle2 className="h-5 w-5 text-amber-600" />
                </div>
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">Total</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Pagos realizados</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">${stats.totalPayouts.toLocaleString()}</p>
              </div>
              <div className="text-xs text-slate-500">
                {stats.pendingPayouts > 0 && `${stats.pendingPayouts} pendiente(s)`}
              </div>
            </div>
          </Card>
        </div>

        {monthlyData && monthlyData.length > 0 && (
          <Card className="border-slate-200 bg-white p-6 shadow-lg">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Rendimiento mensual</h3>
                  <p className="mt-1 text-sm text-slate-600">Ingresos vs gastos</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl border-slate-200">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver detalle
                </Button>
              </div>
              <div className="space-y-4">
                {monthlyData.map((data) => {
                  const maxEarnings = Math.max(...monthlyData.map((item) => item.earnings));
                  return (
                    <div key={data.month} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{data.month}</span>
                        <div className="flex gap-4">
                          <span className="font-semibold text-emerald-600">
                            ${data.earnings.toLocaleString()}
                          </span>
                          {data.expenses > 0 && (
                            <span className="font-semibold text-red-600">
                              -${data.expenses.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex h-8 gap-2">
                        <div
                          className="flex items-center justify-end rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 text-xs font-medium text-white transition-all duration-500"
                          style={{ width: `${(data.earnings / maxEarnings) * 100}%` }}
                        >
                          Ingresos
                        </div>
                        {data.expenses > 0 && (
                          <div
                            className="flex items-center justify-end rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-3 text-xs font-medium text-white transition-all duration-500"
                            style={{ width: `${(data.expenses / maxEarnings) * 30}%` }}
                          >
                            Gastos
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        <Card className="border-slate-200 bg-white p-6 shadow-lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Movimientos recientes</h3>
                <p className="mt-1 text-sm text-slate-600">Ingresos, gastos y pagos</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200">
                Ver todo
              </Button>
            </div>
            {transactions.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-12 w-12" />}
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
          </div>
        </Card>
      </div>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const typeConfig = {
    income: {
      icon: <ArrowUpRight className="h-4 w-4" />,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      amountColor: 'text-emerald-600'
    },
    expense: {
      icon: <ArrowDownRight className="h-4 w-4" />,
      color: 'bg-red-50 text-red-600 border-red-200',
      amountColor: 'text-red-600'
    },
    payout: {
      icon: <CreditCard className="h-4 w-4" />,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      amountColor: 'text-blue-600'
    }
  }[transaction.type];

  const statusConfig = {
    completed: { label: 'Completado', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
    pending: { label: 'Pendiente', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
    processing: { label: 'Procesando', color: 'bg-blue-500/10 text-blue-700 border-blue-200' }
  }[transaction.status];

  return (
    <Card className="border-slate-200 bg-white p-4 transition-all hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-4">
          <div className={`rounded-xl border p-3 ${typeConfig.color}`}>
            {typeConfig.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 truncate font-semibold text-slate-900">{transaction.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{transaction.date}</span>
              {transaction.propertyName && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Home className="h-3.5 w-3.5" />
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
          <Badge className={`${statusConfig.color} border`}>{statusConfig.label}</Badge>
          <p className={`min-w-[120px] text-right text-xl font-bold ${typeConfig.amountColor}`}>
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
    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center space-y-4">
        <div className="rounded-2xl bg-white p-4 text-slate-400 shadow-sm">{icon}</div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="text-slate-600">{description}</p>
        </div>
      </div>
    </Card>
  );
}
