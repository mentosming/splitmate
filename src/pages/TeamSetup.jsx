import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, LogOut, Clock, PlusCircle } from 'lucide-react';

export default function TeamSetup() {
    const { currentUser, userTeams, changeCurrentTeam } = useAuth();
    const [teamName, setTeamName] = useState('');
    const [loading, setLoading] = useState(false);
    const [pendingTeams, setPendingTeams] = useState([]);
    const navigate = useNavigate();

    // Fetch teams where user is pending (Live updates)
    useEffect(() => {
        if (!currentUser) return;

        const fetchPending = async () => {
            const { data, error } = await supabase
                .from('team_members')
                .select(`
                    teams (
                        id,
                        name
                    )
                `)
                .eq('user_id', currentUser.id)
                .eq('status', 'pending');

            if (!error && data) {
                setPendingTeams(data.map(item => item.teams));
            }
        };

        fetchPending();

        const channel = supabase
            .channel('pending_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'team_members',
                filter: `user_id=eq.${currentUser.id}`
            }, () => fetchPending())
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [currentUser]);

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        if (!teamName.trim() || loading) return;

        setLoading(true);
        try {
            // 1. Create the team
            const { data: team, error: teamErr } = await supabase
                .from('teams')
                .insert({
                    name: teamName,
                    admin_id: currentUser.id
                })
                .select()
                .single();

            if (teamErr) throw teamErr;

            // 2. Add creator as member
            const { error: memberErr } = await supabase
                .from('team_members')
                .insert({
                    team_id: team.id,
                    user_id: currentUser.id,
                    status: 'member'
                });

            if (memberErr) throw memberErr;

            // 3. Add default participant
            const { error: partErr } = await supabase
                .from('participants')
                .insert({
                    team_id: team.id,
                    name: '我'
                });

            if (partErr) throw partErr;

            // Success: navigate
            changeCurrentTeam({
                id: team.id,
                name: teamName,
                admin_id: currentUser.id,
                created_at: team.created_at,
                member_status: 'member'
            });
            navigate('/dashboard');
        } catch (error) {
            console.error("Error creating team:", error);
            alert("建立失敗");
            setLoading(false);
        }
    };

    const handleSelectTeam = (id) => {
        changeCurrentTeam(id);
        navigate('/dashboard');
    };

    const handleLogout = () => {
        supabase.auth.signOut();
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-2">
                        <Users size={32} />
                    </div>
                </div>
                <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">
                    歡迎來到團隊分帳
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600 px-4">
                    {userTeams.length > 0 ? '選擇現有團隊或建立一個新團隊' : '目前您尚未加入任何團隊'}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-sm border border-gray-100 sm:rounded-lg sm:px-10">

                    {/* Existing Teams List */}
                    {userTeams.length > 0 && (
                        <div className="mb-8">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                我的團隊
                            </label>
                            <div className="space-y-2">
                                {userTeams.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleSelectTeam(t.id)}
                                        className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition flex justify-between items-center group"
                                    >
                                        <span className="font-bold text-gray-800">{t.name}</span>
                                        <Users className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {pendingTeams.length > 0 && (
                        <div className="mb-8 p-6 bg-indigo-50 border border-indigo-200 rounded-2xl shadow-sm animate-pulse-subtle text-center sm:text-left">
                            <h3 className="text-sm font-bold text-indigo-800 flex items-center justify-center sm:justify-start gap-2 mb-4">
                                <Clock className="w-5 h-5 text-indigo-600" /> 加入申請處理中
                            </h3>
                            <ul className="space-y-3">
                                {pendingTeams.map(t => (
                                    <li key={t.id} className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-indigo-100">
                                        <div className="text-left">
                                            <span className="font-black text-indigo-900 block truncate max-w-[150px]">{t.name}</span>
                                            <span className="text-[10px] text-indigo-400 font-medium">申請中</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                            </span>
                                            <span className="text-[10px] font-bold">審核中</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <form onSubmit={handleCreateTeam} className="space-y-6 pt-6 border-t border-gray-100">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                建立全新的團隊
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <input
                                    type="text"
                                    required
                                    value={teamName}
                                    onChange={e => setTeamName(e.target.value)}
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-4 pr-12 sm:text-sm border-gray-300 rounded-md py-3 bg-gray-50 border"
                                    placeholder="輸入團隊名稱，例如：午餐特攻隊"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            <PlusCircle className="mr-2 h-5 w-5" />
                            {loading ? '建立中...' : '建立我的團隊'}
                        </button>
                    </form>

                    <div className="mt-8 flex justify-center border-t border-gray-100 pt-6">
                        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
                            <LogOut className="w-4 h-4" /> 登出並切換帳號
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
