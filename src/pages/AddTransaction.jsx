import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Zap, ChevronDown, ChevronUp, Users } from 'lucide-react';
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
    const [showSplitSection, setShowSplitSection] = useState(false);
    const [loading, setLoading] = useState(false);
    const [participants, setParticipants] = useState([]);

    useEffect(() => {
        if (!currentTeam) return;
        const fetchParticipants = async () => {
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .eq('team_id', currentTeam.id);
            if (!error && data) {
                setParticipants(data);
                setSelectedIds(new Set(data.map(p => p.id)));
                if (data.length > 0) setPayerId(data[0].id);
            }
        };
        fetchParticipants();
    }, [currentTeam]);

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

    const handleEvenSplit = () => {
        const total = parseFloat(totalAmount);
        if (!total || selectedIds.size === 0) return;
        const perPerson = parseFloat((total / selectedIds.size).toFixed(2));
        const newSplits = {};
        const ids = [...selectedIds];
        ids.forEach((id, i) => {
            newSplits[id] = i === ids.length - 1
                ? parseFloat((total - perPerson * (ids.length - 1)).toFixed(2))
                : perPerson;
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
    const isSplitBalanced = !showSplitSection || Math.abs(splitTotal - totalAmountNum) < 0.01;
    const canSubmit = title && payerId && date && totalAmountNum > 0 && isSplitBalanced;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        try {
            const { data: tx, error: txErr } = await supabase
                .from('transactions')
                .insert({
                    team_id: currentTeam.id,
                    title, date,
                    payer_id: payerId,
                    total_amount: totalAmountNum
                })
                .select()
                .single();
            if (txErr) throw txErr;

            if (showSplitSection) {
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
                    <p className="text-sm text-gray-500 mt-1">記錄一筆新消費，可選擇展開分攤明細。</p>
                </div>
                {participants.length === 0 && (
                    <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium">
                        請先至「設定」新增參與者名單
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
                {/* Core fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
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

                    <div className="space-y-2 text-sm">
                        <label className="font-semibold text-gray-700 block">誰先代付？</label>
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
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Optional: Split Section Toggle */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowSplitSection(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition text-left"
                    >
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-500" />
                            <span className="font-semibold text-gray-700 text-sm">分攤明細（選填）</span>
                            {!showSplitSection && (
                                <span className="text-xs text-gray-400 ml-1">— 展開以勾選參與者及均攤金額</span>
                            )}
                        </div>
                        {showSplitSection
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                    </button>

                    {showSplitSection && (
                        <div className="p-5 space-y-4">
                            {/* Controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex gap-3 text-xs">
                                    <button type="button" onClick={() => setSelectedIds(new Set(participants.map(p => p.id)))}
                                        className="text-indigo-600 hover:underline font-medium">全選</button>
                                    <button type="button" onClick={() => { setSelectedIds(new Set()); setSplits({}); }}
                                        className="text-gray-400 hover:underline font-medium">全不選</button>
                                </div>
                                <div className="flex items-center gap-3">
                                    {totalAmount && (
                                        <span className={cn(
                                            "text-xs font-bold px-3 py-1.5 rounded-lg",
                                            isSplitBalanced ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                                        )}>
                                            {isSplitBalanced
                                                ? `✓ 合計 $${splitTotal.toFixed(2)}`
                                                : `合計 $${splitTotal.toFixed(2)} / $${totalAmountNum.toFixed(2)}`
                                            }
                                        </span>
                                    )}
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

                            {/* Participant rows */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {participants.map(p => {
                                    const isSelected = selectedIds.has(p.id);
                                    return (
                                        <div key={p.id} className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                                            isSelected ? "border-indigo-200 bg-indigo-50/50" : "border-gray-100 bg-gray-50 opacity-60"
                                        )}>
                                            <button
                                                type="button"
                                                onClick={() => toggleParticipant(p.id)}
                                                className={cn(
                                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                                    isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 bg-white"
                                                )}
                                            >
                                                {isSelected && (
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                            <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{p.name}</span>
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
                            {showSplitSection && totalAmount && !isSplitBalanced && (
                                <p className="text-xs text-amber-600 font-medium">
                                    ⚠️ 各人金額合計須等於總金額 (${totalAmountNum.toFixed(2)})，差額：${Math.abs(splitTotal - totalAmountNum).toFixed(2)}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-4 pt-2">
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
                            "px-8 py-2.5 rounded-lg font-medium transition text-white shadow-sm",
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
