import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, SplitSquareHorizontal, ListOrdered } from 'lucide-react';
import { cn } from '../lib/utils';

// Split mode constants
const MODE_MANUAL = 'manual'; // Mode 1: enter per-person amounts manually
const MODE_EVEN = 'even';     // Mode 2: total ÷ selected participants

export default function AddTransaction() {
    const { currentTeam } = useAuth();
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [payerId, setPayerId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [mode, setMode] = useState(MODE_MANUAL);
    const [loading, setLoading] = useState(false);
    const [participants, setParticipants] = useState([]);

    // Mode 1 state
    const [splits, setSplits] = useState({});

    // Mode 2 state
    const [totalAmount, setTotalAmount] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());

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

    // --- Mode 1 helpers ---
    const handleSplitChange = (id, val) => {
        setSplits(prev => ({ ...prev, [id]: val ? parseFloat(val) : 0 }));
    };
    const manualTotal = useMemo(() =>
        Object.values(splits).reduce((sum, v) => sum + (v || 0), 0), [splits]);

    // --- Mode 2 helpers ---
    const toggleParticipant = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const totalAmountNum = parseFloat(totalAmount) || 0;
    const perPersonAmount = selectedIds.size > 0 ? totalAmountNum / selectedIds.size : 0;

    // --- Validation ---
    const isMode1Valid = mode === MODE_MANUAL && title && payerId && date && manualTotal > 0;
    const isMode2Valid = mode === MODE_EVEN && title && payerId && date && totalAmountNum > 0 && selectedIds.size > 0;
    const canSubmit = isMode1Valid || isMode2Valid;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);

        const finalTotal = mode === MODE_MANUAL ? manualTotal : totalAmountNum;

        try {
            const { data: tx, error: txErr } = await supabase
                .from('transactions')
                .insert({
                    team_id: currentTeam.id,
                    title, date,
                    payer_id: payerId,
                    total_amount: finalTotal
                })
                .select()
                .single();
            if (txErr) throw txErr;

            let splitRows = [];
            if (mode === MODE_MANUAL) {
                splitRows = Object.entries(splits)
                    .filter(([, amount]) => amount > 0)
                    .map(([id, amount]) => ({
                        transaction_id: tx.id,
                        participant_id: id,
                        amount
                    }));
            } else {
                const ids = [...selectedIds];
                const perPerson = parseFloat((totalAmountNum / ids.length).toFixed(2));
                splitRows = ids.map((id, i) => ({
                    transaction_id: tx.id,
                    participant_id: id,
                    amount: i === ids.length - 1
                        ? parseFloat((totalAmountNum - perPerson * (ids.length - 1)).toFixed(2))
                        : perPerson
                }));
            }

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

            <div className="p-8 border-b border-gray-100">
                <h1 className="text-xl font-bold text-gray-800">新增帳目</h1>
                <p className="text-sm text-gray-500 mt-1">選擇分攤方式後填寫資料。</p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">

                {/* Split Mode Selector */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">分帳方式</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setMode(MODE_MANUAL)}
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                                mode === MODE_MANUAL
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-gray-200 hover:border-gray-300"
                            )}
                        >
                            <ListOrdered className={cn("w-5 h-5 shrink-0", mode === MODE_MANUAL ? "text-indigo-600" : "text-gray-400")} />
                            <div>
                                <p className={cn("font-bold text-sm", mode === MODE_MANUAL ? "text-indigo-700" : "text-gray-700")}>手動分攤</p>
                                <p className="text-xs text-gray-400 mt-0.5">逐個人輸入金額</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode(MODE_EVEN)}
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                                mode === MODE_EVEN
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-gray-200 hover:border-gray-300"
                            )}
                        >
                            <SplitSquareHorizontal className={cn("w-5 h-5 shrink-0", mode === MODE_EVEN ? "text-indigo-600" : "text-gray-400")} />
                            <div>
                                <p className={cn("font-bold text-sm", mode === MODE_EVEN ? "text-indigo-700" : "text-gray-700")}>平均分攤</p>
                                <p className="text-xs text-gray-400 mt-0.5">選人後自動均分</p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Common fields */}
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

                    {/* Mode 2 only: total amount input */}
                    {mode === MODE_EVEN && (
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
                    )}

                    {/* Mode 1 only: auto-calculated total display */}
                    {mode === MODE_MANUAL && (
                        <div className="space-y-2 text-sm">
                            <label className="font-semibold text-gray-700 block">總金額</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                                <input
                                    type="text"
                                    readOnly
                                    value={manualTotal.toFixed(2)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-4 py-3 text-gray-500 font-bold outline-none cursor-not-allowed"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <hr className="border-gray-100" />

                {/* ---- MODE 1: Manual per-person amounts ---- */}
                {mode === MODE_MANUAL && (
                    <div>
                        <div className="mb-5 flex justify-between items-center">
                            <div>
                                <h2 className="text-base font-bold text-gray-800">各人金額</h2>
                                <p className="text-sm text-gray-500 mt-0.5">沒有參與的人請留空。</p>
                            </div>
                            <div className="text-sm font-bold px-3 py-1.5 rounded-lg bg-green-50 text-green-700">
                                合計: ${manualTotal.toFixed(2)}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                            {participants.map(p => (
                                <div key={p.id} className="flex items-center justify-between group">
                                    <span className="text-sm font-medium text-gray-700 truncate pr-4">{p.name}</span>
                                    <div className="relative w-36 shrink-0">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            placeholder="0.00"
                                            value={splits[p.id] === 0 ? '' : splits[p.id] || ''}
                                            onChange={(e) => handleSplitChange(p.id, e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg py-2 pl-7 pr-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-right font-medium text-gray-800"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ---- MODE 2: Even split with participant selection ---- */}
                {mode === MODE_EVEN && (
                    <div>
                        <div className="mb-5 flex justify-between items-center">
                            <div>
                                <h2 className="text-base font-bold text-gray-800">參與人員</h2>
                                <p className="text-sm text-gray-500 mt-0.5">勾選參與此次消費的人。</p>
                            </div>
                            {totalAmountNum > 0 && selectedIds.size > 0 && (
                                <div className="text-sm font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                                    每人: ${perPersonAmount.toFixed(2)}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {participants.map(p => {
                                const isSelected = selectedIds.has(p.id);
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => toggleParticipant(p.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-semibold",
                                            isSelected
                                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                : "border-gray-200 text-gray-400 hover:border-gray-300"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm",
                                            isSelected ? "bg-indigo-500" : "bg-gray-200"
                                        )}>
                                            {p.name.charAt(0)}
                                        </div>
                                        <span className="truncate w-full text-center text-xs">{p.name}</span>
                                        {isSelected && totalAmountNum > 0 && (
                                            <span className="text-xs text-indigo-500 font-medium">${perPersonAmount.toFixed(2)}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-3 flex gap-3 text-xs">
                            <button type="button" onClick={() => setSelectedIds(new Set(participants.map(p => p.id)))}
                                className="text-indigo-600 hover:underline font-medium">全選</button>
                            <button type="button" onClick={() => setSelectedIds(new Set())}
                                className="text-gray-400 hover:underline font-medium">全不選</button>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
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
