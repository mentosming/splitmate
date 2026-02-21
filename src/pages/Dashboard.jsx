import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PlusCircle, RefreshCw, Download, Filter, CircleDollarSign, ChevronDown, ChevronUp, Trash2, Calendar, Lightbulb, ArrowLeftRight, Plane, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Dashboard() {
    const { currentTeam } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [expandedTxId, setExpandedTxId] = useState(null);

    // Fetch Participants
    useEffect(() => {
        if (!currentTeam) return;
        const fetchParticipants = async () => {
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .eq('team_id', currentTeam.id);
            if (!error) setParticipants(data);
        };
        fetchParticipants();

        const channel = supabase
            .channel(`participants-${currentTeam.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `team_id=eq.${currentTeam.id}` }, () => fetchParticipants())
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [currentTeam]);

    // Fetch Transactions with Splits
    useEffect(() => {
        if (!currentTeam) return;

        const fetchTx = async () => {
            const { data, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    transaction_splits (*)
                `)
                .eq('team_id', currentTeam.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Supabase Error:", error);
                setError(error.message);
                setLoading(false);
                return;
            }

            setTransactions(data);
            setLoading(false);
        };

        fetchTx();

        const channel = supabase
            .channel(`tx-${currentTeam.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `team_id=eq.${currentTeam.id}` }, () => fetchTx())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_splits' }, () => fetchTx()) // Simplified split listener
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [currentTeam]);

    const participantMap = useMemo(() => {
        const map = {};
        participants.forEach(p => map[p.id] = p.name);
        return map;
    }, [participants]);

    const balances = useMemo(() => {
        const calc = {};
        participants.forEach(p => calc[p.id] = 0);

        transactions.forEach(tx => {
            // Payer gets positive balance
            if (calc[tx.payer_id] !== undefined) {
                calc[tx.payer_id] += parseFloat(tx.total_amount);
            }
            // Splits decrease balance
            tx.transaction_splits?.forEach(split => {
                if (calc[split.participant_id] !== undefined) {
                    calc[split.participant_id] -= parseFloat(split.amount);
                }
            });
        });
        return calc;
    }, [transactions, participants]);

    const filteredTransactions = useMemo(() => {
        if (!selectedMonth) return transactions;
        return transactions.filter(tx => tx.date.startsWith(selectedMonth));
    }, [transactions, selectedMonth]);

    const handleExportCSV = () => {
        if (filteredTransactions.length === 0) return;

        const headers = ["日期", "項目", "代付者", "總金額", ...participants.map(p => p.name)];
        const rows = filteredTransactions.map(tx => [
            tx.date,
            tx.title,
            participantMap[tx.payer_id] || '未知',
            tx.total_amount,
            ...participants.map(p => {
                const split = tx.transaction_splits.find(s => s.participant_id === p.id);
                return split ? split.amount : 0;
            })
        ]);

        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `分帳紀錄_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDeleteTransaction = async (txId, title) => {
        if (!window.confirm(`確定要刪除「${title}」嗎？此動作無法復原。`)) return;
        try {
            // RLS will handle security, Cascading delete in SQL handles splits
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', txId);
            if (error) throw error;
        } catch (err) {
            console.error("Delete failed:", err);
            alert("刪除失敗");
        }
    };

    const months = useMemo(() => {
        const set = new Set(transactions.map(tx => tx.date.slice(0, 7)));
        set.add(new Date().toISOString().slice(0, 7));
        return Array.from(set).sort().reverse();
    }, [transactions]);

    if (loading) return <div className="text-center py-20 text-gray-400">載入中...</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1200px] mx-auto space-y-6">
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
                    <Filter className="w-5 h-5" />
                    <div className="text-sm">
                        <p className="font-bold">資料載入失敗</p>
                        <p className="opacity-80">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/add" className="bg-[#5F3DC3] hover:bg-[#4E32A1] text-white py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition shadow-sm">
                    <PlusCircle className="w-5 h-5" /> 新增帳目 (支出)
                </Link>
                <Link to="/repayment" className="bg-[#059669] hover:bg-[#047857] text-white py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition shadow-sm">
                    <RefreshCw className="w-5 h-5" /> 還款 / 轉帳
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-gray-800">各人結餘概況 (參與者)</h2>
                    {participants.length === 0 && (
                        <Link to="/settings" className="text-sm text-indigo-600 font-medium hover:underline">
                            前往設定新增參與者 &rarr;
                        </Link>
                    )}
                </div>

                {participants.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-2">還沒有任何消費參與者</p>
                        <p className="text-sm text-gray-400">請團隊管理員至「設定」頁面新增成員名單。</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {participants.map(p => {
                            const balance = balances[p.id] || 0;
                            const isPositive = balance >= 0;

                            return (
                                <div key={p.id} className={cn(
                                    "p-4 rounded-xl border flex justify-between items-start",
                                    isPositive ? "bg-[#F0FDF4] border-[#DCFCE7]" : "bg-[#FEF2F2] border-[#FEE2E2]"
                                )}>
                                    <div className="flex items-start gap-3 overflow-hidden">
                                        <div className="shrink-0">
                                            {p.avatar_url ? (
                                                <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white shadow-sm" />
                                            ) : (
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                                                    isPositive ? "bg-[#D1FAE5] text-[#059669]" : "bg-[#FEE2E2] text-[#DC2626]"
                                                )}>
                                                    {p.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="text-sm font-medium text-gray-500 mb-1 truncate">{p.name}</div>
                                            <div className={cn(
                                                "text-2xl font-bold font-mono tracking-tight",
                                                isPositive ? "text-[#059669]" : "text-[#DC2626]"
                                            )}>
                                                {isPositive ? '+' : ''}{balance.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 hidden sm:flex",
                                        isPositive ? "bg-[#D1FAE5] text-[#059669]" : "bg-[#FEE2E2] text-[#DC2626]"
                                    )}>
                                        <CircleDollarSign className="w-5 h-5" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-md relative overflow-hidden group">
                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                <ArrowLeftRight className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold">還款變得更簡單</h4>
                        </div>
                        <p className="text-sm text-indigo-100 font-medium">使用導航欄的「還款及轉賬」按鈕，快速平衡成員間的債務，無需複雜分帳。</p>
                        <Link to="/repayment" className="inline-flex items-center gap-1.5 text-xs font-black bg-white text-indigo-600 px-3 py-1.5 rounded-full self-start hover:bg-indigo-50 transition">
                            立即前往
                        </Link>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between gap-4 group">
                    <div className="flex items-center gap-2">
                        <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                            <Lightbulb className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-gray-800">小撇步</h4>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">您可以點擊下方帳目列表的箭頭，查看每個人具體分攤了多少錢，確保帳目透明。</p>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                            <Plane className="w-3 h-3" /> 旅行必備
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                            <Rocket className="w-3 h-3" /> 團隊高效
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">最近帳目</h2>
                        <p className="text-sm text-gray-500">查看詳細交易紀錄</p>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none min-w-[140px]">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 appearance-none focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            >
                                <option value="">全部月份</option>
                                {months.map(m => (
                                    <option key={m} value={m}>{m.replace('-', '年')}月</option>
                                ))}
                            </select>
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        <button
                            onClick={handleExportCSV}
                            disabled={filteredTransactions.length === 0}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" /> 匯出 CSV
                        </button>
                    </div>
                </div>

                <div className="p-4 sm:p-6 flex flex-col items-center justify-center text-center">
                    {filteredTransactions.length === 0 ? (
                        <div className="py-12">
                            <Filter className="w-12 h-12 text-gray-300 mb-4 mx-auto" />
                            <h3 className="text-gray-500 font-medium mb-1">尚無帳目</h3>
                            <p className="text-sm text-gray-400">請嘗試更換篩選條件或新增帳目。</p>
                        </div>
                    ) : (
                        <div className="w-full space-y-2">
                            {filteredTransactions.map(tx => {
                                const isExpanded = expandedTxId === tx.id;
                                return (
                                    <div key={tx.id} className="group border border-transparent hover:border-indigo-100 rounded-xl transition-all overflow-hidden bg-white hover:shadow-sm">
                                        <div
                                            onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 px-4 cursor-pointer transition"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-gray-50 group-hover:bg-indigo-50 rounded-lg transition">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{tx.title}</div>
                                                    <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{tx.date}</div>
                                                </div>
                                            </div>
                                            <div className="mt-2 sm:mt-0 flex items-center gap-6 self-end sm:self-auto">
                                                <div className="text-right">
                                                    <div className="font-black text-gray-900 text-lg">${parseFloat(tx.total_amount).toFixed(2)}</div>
                                                    <div className="text-[10px] text-gray-500">由 {participantMap[tx.payer_id] || '未知成員'} 支付</div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTransaction(tx.id, tx.title);
                                                    }}
                                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-14 pb-4 pt-2 border-t border-gray-50 bg-gray-50/30 animate-in slide-in-from-top-2 duration-300">
                                                <div className="flex flex-wrap gap-x-6 gap-y-2">
                                                    {participants.map(p => {
                                                        const split = tx.transaction_splits?.find(s => s.participant_id === p.id);
                                                        const pAmount = split ? split.amount : 0;
                                                        if (pAmount <= 0) return null;
                                                        return (
                                                            <div key={p.id} className="flex items-center gap-1.5 text-xs">
                                                                <span className="text-gray-400 font-medium">{p.name}</span>
                                                                <span className="font-bold text-indigo-600">${parseFloat(pAmount).toFixed(2)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
