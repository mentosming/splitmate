import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Users, Receipt, Trash2, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

export default function AdminDashboard() {
    const { currentUser } = useAuth();
    const [teams, setTeams] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Prevent access if not admin
    if (currentUser?.email !== 'ming1988@gmail.com') {
        return <Navigate to="/dashboard" replace />;
    }

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch all teams
            const { data: teamsData, error: teamsError } = await supabase
                .from('teams')
                .select('*')
                .order('created_at', { ascending: false });

            if (teamsError) throw teamsError;

            // Fetch all transactions
            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false });

            if (txError) throw txError;

            setTeams(teamsData || []);
            setTransactions(txData || []);
        } catch (err) {
            console.error("Admin fetch error:", err);
            setError("無法獲取資料，請確認 Supabase 的 RLS 是否已設定允許 ming1988@gmail.com 存取所有資料。 (" + err.message + ")");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDeleteTeam = async (teamId, teamName) => {
        if (!window.confirm(`【危險動作】確定要永久刪除團隊「${teamName}」嗎？這將刪除該團隊所有資料且無法復原！`)) {
            return;
        }

        try {
            // Manual CASCADE deletes because Supabase might not have ON DELETE CASCADE set up for this schema yet.

            // 1. Delete all transaction_splits for transactions in this team
            // (Since we can't easily do a join-delete in one query without an RPC, we delete splits by finding transactions first, or we can just delete transactions and hope splits cascade. The error says participants delete fails because of transaction_splits. This means transaction_splits -> participants has a foreign key. We should delete transactions and their splits first.)

            // Actually, deleting transactions might fail if there's no cascade on splits. Let's delete splits first by getting all tx ids.
            const { data: txs_to_delete } = await supabase.from('transactions').select('id').eq('team_id', teamId);
            if (txs_to_delete && txs_to_delete.length > 0) {
                const txIds = txs_to_delete.map(t => t.id);
                // Delete splits
                await supabase.from('transaction_splits').delete().in('transaction_id', txIds);
                // Delete transactions
                await supabase.from('transactions').delete().eq('team_id', teamId);
            }

            // 2. Delete participants
            await supabase.from('participants').delete().eq('team_id', teamId);

            // 3. Delete team_members
            await supabase.from('team_members').delete().eq('team_id', teamId);

            // 4. Finally, delete the team itself
            const { error: deleteError } = await supabase
                .from('teams')
                .delete()
                .eq('id', teamId);

            if (deleteError) throw deleteError;

            alert(`成功刪除團隊: ${teamName}`);
            fetchData(); // Refresh data
        } catch (err) {
            console.error("Delete failed:", err);
            alert("刪除失敗: " + err.message);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-gray-500 font-medium">載入全站資料中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <ShieldAlert className="w-8 h-8 text-rose-600" />
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">絕對後台 (Super Admin)</h1>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">
                            管理員權限: <span className="text-gray-800 font-bold bg-gray-100 px-2 py-0.5 rounded">{currentUser.email}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchData}
                            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                            title="重新整理"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium transition cursor-pointer">
                            <ArrowLeft className="w-4 h-4" /> 返回前台
                        </Link>
                    </div>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-rose-800">API 錯誤</h3>
                            <p className="text-rose-600 text-sm mt-1">{error}</p>
                            <p className="text-rose-600 text-xs mt-2 font-mono">
                                請至 Supabase SQL Editor 執行:<br />
                                CREATE POLICY "Admin All" ON public.teams FOR ALL USING (auth.jwt() -{'>'}{'>'} 'email' = 'ming1988@gmail.com');
                            </p>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">全站總團隊數</p>
                            <div className="text-4xl font-black text-indigo-900">{teams.length}</div>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-indigo-500" />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">全站總帳目數</p>
                            <div className="text-4xl font-black text-emerald-900">{transactions.length}</div>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
                            <Receipt className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                </div>

                {/* Team List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-lg font-bold text-gray-900">團隊管理列表</h2>
                        <p className="text-sm text-gray-500">檢視系統內建立的所有團隊，您可以強制刪除違規或測試用的團隊。</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 text-sm text-gray-400">
                                    <th className="p-4 font-semibold uppercase tracking-wider">團隊名稱</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider">團隊 ID</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider">建立時間</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teams.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-gray-400">尚無團隊資料</td>
                                    </tr>
                                ) : (
                                    teams.map(team => (
                                        <tr key={team.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-800">{team.name}</div>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-gray-500">
                                                {team.id}
                                            </td>
                                            <td className="p-4 text-sm text-gray-500">
                                                {new Date(team.created_at).toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteTeam(team.id, team.name)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition"
                                                    title="強制刪除此團隊"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> 刪除
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
