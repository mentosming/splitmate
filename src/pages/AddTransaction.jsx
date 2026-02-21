import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Zap, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AddTransaction() {
    const { currentTeam } = useAuth();
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [payerId, setPayerId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [totalAmount, setTotalAmount] = useState('');
    const [splits, setSplits] = useState({});
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [participants, setParticipants] = useState([]);

    // Fetch participants
    useEffect(() => {
        if (!currentTeam) return;
        const fetchParticipants = async () => {
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .eq('team_id', currentTeam.id);
            if (!error && data) {
                setParticipants(data);
                // Default: all selected
                setSelectedIds(new Set(data.map(p => p.id)));
                if (data.length > 0) setPayerId(data[0].id);
            }
        };
        fetchParticipants();
    }, [currentTeam]);

    // Toggle participant selection
    const toggleParticipant = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                setSplits(s => { const n = { ...s }; delete n[id]; return n; });
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSplitChange = (id, val) => {
        setSplits(prev => ({ ...prev, [id]: val ? parseFloat(val) : 0 }));
    };

    // One-tap even split
    const handleEvenSplit = () => {
        const total = parseFloat(totalAmount);
        if (!total || selectedIds.size === 0) return;
        const perPerson = parseFloat((total / selectedIds.size).toFixed(2));
        const newSplits = {};
        const ids = [...selectedIds];
        ids.forEach((id, i) => {
            // Give the last person any rounding remainder
            if (i === ids.length - 1) {
                const others = perPerson * (ids.length - 1);
                newSplits[id] = parseFloat((total - others).toFixed(2));
            } else {
                newSplits[id] = perPerson;
            }
        });
        setSplits(newSplits);
    };

    const splitTotal = useMemo(() =>
        Object.entries(splits)
            .filter(([id]) => selectedIds.has(id))
            .reduce((sum, [, v]) => sum + (v || 0), 0),
        [splits, selectedIds]
    );

    const totalAmountNum = parseFloat(totalAmount) || 0;
    const isBalanced = totalAmount && Math.abs(splitTotal - totalAmountNum) < 0.01;
    const canSubmit = title && payerId && date && totalAmountNum > 0 && isBalanced && selectedIds.size > 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        try {
            const { data: tx, error: txErr } = await supabase
                .from('transactions')
                .insert({
                    team_id: currentTeam.id,
                    title,
                    date,
                    payer_id: payerId,
                    total_amount: totalAmountNum
                })
                .select()
                .single();
            if (txErr) throw txErr;

            const splitRows = [...selectedIds]
                .filter(id => splits[id] > 0)
                .map(id => ({
                    transaction_id: tx.id,
                    participant_id: id,
                    amount: splits[id]
                }));

            if (splitRows.length > 0) {
                const { error: splitErr } = await supabase
                    .from('transaction_splits')
                    .insert(splitRows);
                if (splitErr) throw splitErr;
            }
            navigate('/dashboard');
        } catch (error) {
            console.error('Error creating transaction:', error);
            alert('新增失敗，請重試');
            setLoading(false);
        }
    };

    if (!currentTeam) return <div className="text-center py-20 text-gray-400">載入中...</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1000px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200">

            <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">新增帳目</h1>
                    <p className="text-sm text-gray-500 mt-1">勾選參與者 → 輸入總金額 → 一鍵均攤或手動調整。</p>
                </div>
                {participants.length === 0 && (
                    <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium">
                        請先至「設定」新增參與者名單
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Title */}
                    <div className="space-y-2 text-sm">
                        <label className="font-semibold text-gray-700 block">項目名稱</label>
                        <input
                            type="text"
                            placeholder="例如：今日午餐"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                            required
                        />
                    </div>

                    {/* Date */}
                    <div className="space-y-2 text-sm">
                        <label className="font-semibold text-gray-700 block">日期</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700"
                                required
                            />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Payer */}
                    <div className="space-y-2 text-sm">
                        <label className="font-semibold text-gray-700 block">誰先代付款項？</label>
                        <select
                            value={payerId}
                            onChange={e => setPayerId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700 appearance-none bg-white"
                            required
                            disabled={participants.length === 0}
                        >
                            <option value="" disabled>選擇代付者</option>
                            {participants.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Total Amount */}
                    <div className="space-y-2 text-sm">
                        <label className="font-semibold text-gray-700 block">總金額</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="any"
                                placeholder="0.00"
                                value={totalAmount}
                                onChange={e => setTotalAmount(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-gray-700"
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-gray-100" />

                {/* Participant Selection + Split */}
                <div>
                    <div className="mb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">各人分攤</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                勾選參與者，再點「均攤」或手動填寫金額。
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Balance indicator */}
                            {totalAmount && (
                                <div className={cn(
                                    "text-xs font-bold px-3 py-1.5 rounded-lg",
                                    isBalanced
                                        ? "bg-green-50 text-green-700"
                                        : "bg-amber-50 text-amber-700"
                                )}>
                                    {isBalanced
                                        ? `✓ 合計 $${splitTotal.toFixed(2)}`
                                        : `合計 $${splitTotal.toFixed(2)} / $${totalAmountNum.toFixed(2)}`
                                    }
                                </div>
                            )}
                            {/* Even split button */}
                            <button
                                type="button"
                                onClick={handleEvenSplit}
                                disabled={!totalAmount || selectedIds.size === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 text-sm font-bold rounded-lg transition"
                            >
                                <Zap className="w-4 h-4" />
                                均攤 ({selectedIds.size} 人)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {participants.map(p => {
                            const isSelected = selectedIds.has(p.id);
                            return (
                                <div
                                    key={p.id}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                                        isSelected
                                            ? "border-indigo-200 bg-indigo-50/50"
                                            : "border-gray-100 bg-gray-50 opacity-60"
                                    )}
                                >
                                    {/* Checkbox */}
                                    <button
                                        type="button"
                                        onClick={() => toggleParticipant(p.id)}
                                        className={cn(
                                            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                            isSelected
                                                ? "bg-indigo-600 border-indigo-600 text-white"
                                                : "border-gray-300 bg-white"
                                        )}
                                    >
                                        {isSelected && (
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>

                                    <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{p.name}</span>

                                    {/* Amount input */}
                                    <div className="relative w-28 shrink-0">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            placeholder="0.00"
                                            disabled={!isSelected}
                                            value={isSelected ? (splits[p.id] || '') : ''}
                                            onChange={(e) => handleSplitChange(p.id, e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg py-2 pl-7 pr-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-right font-medium text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Select All / None */}
                    <div className="mt-3 flex gap-3">
                        <button type="button" onClick={() => setSelectedIds(new Set(participants.map(p => p.id)))}
                            className="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-1">
                            <Users className="w-3 h-3" /> 全選
                        </button>
                        <button type="button" onClick={() => { setSelectedIds(new Set()); setSplits({}); }}
                            className="text-xs text-gray-400 hover:underline font-medium">
                            全不選
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !canSubmit}
                        className={cn(
                            "px-8 py-2.5 rounded-lg font-medium transition text-white shadow-sm flex items-center justify-center",
                            canSubmit ? "bg-[#5F3DC3] hover:bg-[#4E32A1]" : "bg-gray-300 cursor-not-allowed"
                        )}
                    >
                        {loading ? '儲存中...' : '儲存帳目'}
                    </button>
                </div>
            </form>
        </div>
    );
}
