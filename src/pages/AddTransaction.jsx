import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AddTransaction() {
    const { currentTeam } = useAuth();
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [payerId, setPayerId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [splits, setSplits] = useState({});
    const [loading, setLoading] = useState(false);
    const [participants, setParticipants] = useState([]);

    // Fetch participants from database
    useEffect(() => {
        if (!currentTeam) return;
        const fetchParticipants = async () => {
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .eq('team_id', currentTeam.id);
            if (!error) {
                setParticipants(data);
                if (data.length > 0 && !payerId) {
                    setPayerId(data[0].id);
                }
            }
        };
        fetchParticipants();
    }, [currentTeam]);

    const handleSplitChange = (participantId, amountStr) => {
        const val = amountStr ? parseFloat(amountStr) : 0;
        setSplits(prev => ({ ...prev, [participantId]: val }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const currentSplitTotal = Object.values(splits).reduce((sum, val) => sum + (val || 0), 0);

        if (!title || !payerId || !date) {
            alert('請填寫完整資訊');
            return;
        }

        if (participants.length === 0) {
            alert('沒有可參與分帳的名單！請先至「設定」頁面新增參與者。');
            return;
        }

        if (currentSplitTotal <= 0) {
            alert('總金額必須大於 0！');
            return;
        }

        setLoading(true);
        try {
            // 1. Insert Transaction
            const { data: tx, error: txErr } = await supabase
                .from('transactions')
                .insert({
                    team_id: currentTeam.id,
                    title,
                    date,
                    payer_id: payerId,
                    total_amount: currentSplitTotal
                })
                .select()
                .single();

            if (txErr) throw txErr;

            // 2. Prepare and Insert Splits
            const splitRows = Object.entries(splits)
                .filter(([_, amount]) => amount > 0)
                .map(([pId, amount]) => ({
                    transaction_id: tx.id,
                    participant_id: pId,
                    amount: amount
                }));

            if (splitRows.length > 0) {
                const { error: splitErr } = await supabase
                    .from('transaction_splits')
                    .insert(splitRows);
                if (splitErr) throw splitErr;
            }

            navigate('/dashboard');
        } catch (error) {
            console.error("Error creating transaction: ", error);
            alert('新增失敗，請重試');
            setLoading(false);
        }
    };

    const currentSplitTotal = Object.values(splits).reduce((sum, val) => sum + (val || 0), 0);
    const isValid = currentSplitTotal > 0;

    if (!currentTeam) return <div className="text-center py-20 text-gray-400">載入中...</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1000px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200">

            <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">新增帳目</h1>
                    <p className="text-sm text-gray-500 mt-1">記錄一筆新消費。總金額會根據參與者的金額自動計算。</p>
                </div>
                {participants.length === 0 && (
                    <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium">
                        請先至「設定」新增參與者名單
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-10">
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

                    <div className="space-y-2 text-sm">
                        <label className="font-semibold text-gray-700 block">總金額</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                            <input
                                type="text"
                                value={currentSplitTotal.toFixed(2)}
                                readOnly
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-4 py-3 text-gray-500 font-bold outline-none cursor-not-allowed"
                            />
                        </div>
                    </div>

                </div>

                <hr className="border-gray-100" />

                <div>
                    <div className="mb-6 flex justify-between items-end">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">各人分攤</h2>
                            <p className="text-sm text-gray-500 mt-1">輸入每個人應付的金額。如果沒參加，請留空。</p>
                        </div>
                        <div className="text-sm font-bold px-3 py-1.5 rounded-lg bg-[#F0FDF4] text-[#059669]">
                            目前加總: ${currentSplitTotal.toFixed(2)}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                        {participants.map(p => (
                            <div key={p.id} className="flex items-center justify-between group">
                                <span className="text-sm font-medium text-gray-700 truncate pr-4">{p.name}</span>
                                <div className="relative w-36 shrink-0 transition-transform group-focus-within:scale-105">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="any"
                                        placeholder="0.00"
                                        value={splits[p.id] === 0 ? '' : splits[p.id] || ''}
                                        onChange={(e) => handleSplitChange(p.id, e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg py-2 pl-7 pr-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-right font-medium text-gray-800"
                                        disabled={participants.length === 0}
                                    />
                                </div>
                            </div>
                        ))}
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
                        disabled={loading || !isValid || participants.length === 0}
                        className={cn(
                            "px-8 py-2.5 rounded-lg font-medium transition text-white shadow-sm flex items-center justify-center",
                            isValid && participants.length > 0
                                ? "bg-[#5F3DC3] hover:bg-[#4E32A1]"
                                : "bg-gray-300 cursor-not-allowed"
                        )}
                    >
                        {loading ? '儲存中...' : '儲存帳目'}
                    </button>
                </div>
            </form>
        </div>
    );
}
