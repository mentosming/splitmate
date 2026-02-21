import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Repayment() {
    const { currentTeam } = useAuth();
    const navigate = useNavigate();

    const [payorId, setPayorId] = useState('');
    const [payeeId, setPayeeId] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
            if (!error && data.length > 0) {
                setParticipants(data);
                if (!payorId) setPayorId(data[0].id);
                if (!payeeId && data.length >= 2) setPayeeId(data[1].id);
            }
        };
        fetchParticipants();
    }, [currentTeam]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);

        if (!payorId || !payeeId || !numAmount || !date) {
            alert('請填寫完整資訊');
            return;
        }

        if (payorId === payeeId) {
            alert('還款人與收款人不能為同一人');
            return;
        }

        if (numAmount <= 0) {
            alert('金額必須大於 0');
            return;
        }

        setLoading(true);
        try {
            const payorName = participants.find(p => p.id === payorId)?.name || '未知';
            const payeeName = participants.find(p => p.id === payeeId)?.name || '未知';

            // 1. Insert Transaction (Repayment)
            const { data: tx, error: txErr } = await supabase
                .from('transactions')
                .insert({
                    team_id: currentTeam.id,
                    title: `還款轉賬: ${payorName} ➡️ ${payeeName}`,
                    date,
                    payer_id: payorId, // The one giving money (balance increases)
                    total_amount: numAmount,
                    is_repayment: true
                })
                .select()
                .single();

            if (txErr) throw txErr;

            // 2. Insert Split for the Payee
            const { error: splitErr } = await supabase
                .from('transaction_splits')
                .insert({
                    transaction_id: tx.id,
                    participant_id: payeeId, // The one receiving money (balance decreases)
                    amount: numAmount
                });

            if (splitErr) throw splitErr;

            navigate('/dashboard');
        } catch (error) {
            console.error("Error adding repayment: ", error);
            alert('儲存失敗，請重試');
            setLoading(false);
        }
    };

    if (!currentTeam) return <div className="text-center py-20 text-gray-400">載入中...</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[800px] mx-auto bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-8 border-b border-gray-100">
                <h1 className="text-xl font-bold text-gray-800">還款及轉賬</h1>
                <p className="text-sm text-gray-500 mt-1">記錄成員間的直接轉帳，系統會自動沖銷對應的債務。</p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

                    {/* Payor */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">還款人 (誰給錢？)</label>
                        <select
                            value={payorId}
                            onChange={e => setPayorId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none bg-white text-lg font-bold text-gray-800"
                        >
                            {participants.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Arrow for visual */}
                    <div className="hidden md:flex justify-center pt-6">
                        <div className="p-3 bg-indigo-50 rounded-full">
                            <ArrowRight className="w-6 h-6 text-indigo-500" />
                        </div>
                    </div>

                    {/* Payee */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">收款人 (誰拿錢？)</label>
                        <select
                            value={payeeId}
                            onChange={e => setPayeeId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none bg-white text-lg font-bold text-gray-800"
                        >
                            {participants.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">轉賬金額</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                            <input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-2xl font-black text-gray-900"
                                required
                            />
                        </div>
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">日期</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-gray-700 font-medium"
                                required
                            />
                            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-8 border-t border-gray-50">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition"
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !amount || payorId === payeeId}
                        className={cn(
                            "px-10 py-3 rounded-xl font-bold transition text-white shadow-md flex items-center justify-center",
                            amount && payorId !== payeeId && !loading
                                ? "bg-indigo-600 hover:bg-indigo-700"
                                : "bg-gray-300 cursor-not-allowed shadow-none"
                        )}
                    >
                        {loading ? '記錄中...' : '確認完成轉賬'}
                    </button>
                </div>
            </form>
        </div>
    );
}
