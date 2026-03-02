import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, UserCheck, ArrowRight, Globe, Wallet, Plane, Rocket, Layers, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

import logo from '../assets/logo.png';

export default function Login() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const inviteTeamId = searchParams.get('invite')?.trim();
    const [invitedTeamName, setInvitedTeamName] = useState('');
    const { currentUser, joinTeam } = useAuth();
    const [joining, setJoining] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (inviteTeamId) {
            const fetchInvitedTeam = async () => {
                const { data, error } = await supabase
                    .from('teams')
                    .select('name')
                    .eq('id', inviteTeamId)
                    .single();

                if (data) {
                    setInvitedTeamName(data.name);
                } else {
                    setInvitedTeamName('找不到此團隊');
                }
            };
            fetchInvitedTeam();

            // Subscribe to team name changes (optional but helps parity with Firestore)
            const channel = supabase
                .channel(`team-${inviteTeamId}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'teams',
                    filter: `id=eq.${inviteTeamId}`
                }, (payload) => {
                    setInvitedTeamName(payload.new.name);
                })
                .subscribe();

            return () => supabase.removeChannel(channel);
        }
    }, [inviteTeamId]);

    const [existingStatus, setExistingStatus] = useState(null); // 'member', 'pending', or null

    useEffect(() => {
        if (currentUser && inviteTeamId) {
            const checkMembership = async () => {
                const { data, error } = await supabase
                    .from('team_members')
                    .select('status')
                    .eq('team_id', inviteTeamId)
                    .eq('user_id', currentUser.id)
                    .maybeSingle();

                if (data) {
                    setExistingStatus(data.status);
                } else {
                    setExistingStatus(null);
                }
            };
            checkMembership();
        }
    }, [currentUser, inviteTeamId]);

    const handleConfirmJoin = async () => {
        if (!inviteTeamId || !currentUser) return;
        setJoining(true);
        setError('');
        try {
            const success = await joinTeam(inviteTeamId);
            if (success) {
                // Refresh status after joining
                setExistingStatus('pending');
                navigate('/setup');
            } else {
                setError('找不到受邀團隊。');
            }
        } catch (err) {
            console.error(err);
            setError('加入失敗，請重試。');
        } finally {
            setJoining(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname + (inviteTeamId ? `?invite=${inviteTeamId}` : '')
                }
            });
            if (error) throw error;
            // Note: Oauth usually redirects, so loading state stays until redirect happens.
        } catch (err) {
            console.error(err);
            setError('登入失敗，請重試。');
            setLoading(false);
        }
    };

    const features = [
        {
            icon: <Globe className="text-blue-500" />,
            title: "出國旅行分帳",
            desc: "多人旅遊時，誰付飯店、誰出路費？一鍵記錄自動結算，享受旅程不尷尬。"
        },
        {
            icon: <Rocket className="text-indigo-500" />,
            title: "團隊/合租計費",
            desc: "辦公室訂餐、合租水電費？專為多人協作設計，透明又清楚。"
        },
        {
            icon: <ShieldCheck className="text-emerald-500" />,
            title: "安全且透明",
            desc: "所有紀錄雲端備份，成員隨時查看。支援 CSV 匯出，對帳更輕鬆。"
        }
    ];

    const PlanetIcon = Globe; // Mapping for consistency

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Minimal Header */}
            <header className="px-6 py-8 sm:px-12 flex justify-between items-center max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-3 group">
                    <img src={logo} alt="Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform object-cover" />
                    <h1 className="text-xl font-black tracking-tighter text-gray-900">SplitMate</h1>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full border border-indigo-100">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">全新 V3 版本已上線</span>
                </div>
            </header>

            <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-16 px-6 py-12 lg:py-0 max-w-7xl mx-auto w-full">
                {/* Left: Product Value Prop */}
                <div className="flex-1 space-y-12 text-center lg:text-left">
                    <div className="space-y-6">
                        <h2 className="text-5xl sm:text-7xl font-black text-gray-900 leading-[1.1] tracking-tight">
                            不再為 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">分帳</span> <br />
                            感到頭痛。
                        </h2>
                        <p className="text-lg sm:text-xl text-gray-500 font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
                            專為現代團隊、朋友聚會與旅遊愛好者設計的精準分帳工具。簡單、快速、且具備豐富的統計功能。
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto lg:mx-0">
                        {features.map((f, i) => (
                            <div key={i} className="group p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500 overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-full -mr-12 -mt-12 group-hover:bg-indigo-50 transition-colors"></div>
                                <div className="relative z-10 space-y-4">
                                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                        {f.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-gray-900 mb-1">{f.title}</h3>
                                        <p className="text-xs text-gray-400 font-medium leading-relaxed">{f.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Login Card */}
                <div className="flex justify-center lg:justify-end animate-in fade-in slide-in-from-right-8 duration-700">
                    <div className="w-full max-w-md bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-gray-100 relative overflow-hidden group">

                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                        <div className="relative mb-10 text-center sm:text-left">
                            <h2 className="text-2xl font-black text-gray-900">開始體驗</h2>
                            <p className="text-gray-400 text-sm font-medium mt-1">使用 Google 帳號，一秒同步您的分帳數據</p>
                        </div>

                        {inviteTeamId && (
                            <div className="mb-8 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between group/invite animate-in zoom-in-95 duration-300">
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">受邀加入團隊</p>
                                    <p className="text-lg font-black text-indigo-700 truncate max-w-[180px]">{invitedTeamName || '正在載入...'}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm ring-1 ring-indigo-50">
                                    <UserCheck className="w-5 h-5" />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                                <p className="text-xs text-red-700 font-bold">{error}</p>
                            </div>
                        )}

                        {currentUser && inviteTeamId ? (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    {currentUser.user_metadata?.avatar_url && (
                                        <img src={currentUser.user_metadata.avatar_url} alt="" className="w-10 h-10 rounded-full ring-2 ring-white shadow-sm" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">已登入</p>
                                        <p className="font-bold text-gray-900 truncate">{currentUser.user_metadata?.full_name}</p>
                                    </div>
                                </div>

                                {existingStatus === 'pending' ? (
                                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                                        <p className="text-amber-800 font-bold text-sm mb-3">加入申請審核中</p>
                                        <button
                                            onClick={() => navigate('/setup')}
                                            className="w-full flex items-center justify-center py-3 px-6 rounded-xl bg-white border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-100 transition shadow-sm"
                                        >
                                            查看我的團隊
                                        </button>
                                    </div>
                                ) : existingStatus === 'member' || existingStatus === 'admin' ? (
                                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                                        <p className="text-emerald-800 font-bold text-sm mb-3">您已是此團隊成員</p>
                                        <button
                                            onClick={() => navigate('/setup')}
                                            className="w-full flex items-center justify-center py-3 px-6 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-sm shadow-emerald-100"
                                        >
                                            立即進入儀表板
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleConfirmJoin}
                                        disabled={joining || !invitedTeamName}
                                        className="group/btn w-full flex items-center justify-center py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all active:scale-[0.98] shadow-lg shadow-indigo-200"
                                    >
                                        <span>{joining ? '正在加入...' : '加入此團隊'}</span>
                                        {!joining && <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button
                                    onClick={handleGoogleLogin}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border border-gray-200 rounded-2xl hover:border-gray-900 hover:bg-gray-50 transition-all font-bold text-gray-700 shadow-sm active:scale-[0.98]"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    <span>{loading ? '正在啟動...' : '使用 Google 帳號登入'}</span>
                                </button>
                                <p className="text-center text-[10px] text-gray-400 font-medium px-4">
                                    註冊即表示您同意系統條款，我們會保護您的隱私資料。
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Subtle Footer */}
            <footer className="mt-auto border-t border-gray-100 py-10 px-6">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-400 font-medium">© 2026 SplitMate. 分帳好拍檔。</p>
                    <div className="flex gap-6 text-[10px] font-black text-gray-300 uppercase tracking-widest">
                        <span>計費方案</span>
                        <span>隱私聲明</span>
                        <span>聯繫支援</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}


