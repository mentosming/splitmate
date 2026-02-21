import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Link as LinkIcon, CheckCircle, XCircle, Copy, AlertTriangle, Plus, Trash2, Camera } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
    const { currentTeam, currentUser } = useAuth();
    const navigate = useNavigate();
    const [pendingUsers, setPendingUsers] = useState([]);
    const [members, setMembers] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copySuccess, setCopySuccess] = useState(false);

    const [newParticipantName, setNewParticipantName] = useState('');
    const [addingParticipant, setAddingParticipant] = useState(false);

    // Delete Team State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [imageErrors, setImageErrors] = useState(new Set());

    const isOwner = currentTeam?.admin_id === currentUser?.id;
    const currentUserStatus = members.find(m => m.id === currentUser?.id)?.status;
    const isAdmin = isOwner || currentUserStatus === 'admin';

    const fetchMembers = useCallback(async () => {
        if (!currentTeam) return;
        setLoading(true);
        try {
            // Fetch All Members (Active & Pending) with Profile data
            const { data, error } = await supabase
                .from('team_members')
                .select(`
                    status,
                    user_id,
                    profiles (
                        display_name,
                        email,
                        avatar_url
                    )
                `)
                .eq('team_id', currentTeam.id);

            if (error) throw error;

            const active = data.filter(m => m.status === 'member' || m.status === 'admin').map(m => ({
                id: m.user_id,
                status: m.status,
                ...m.profiles,
                avatar_url: m.profiles?.avatar_url || m.profiles?.photo_url // Support both
            }));
            const pending = data.filter(m => m.status === 'pending').map(m => ({
                id: m.user_id,
                ...m.profiles,
                avatar_url: m.profiles?.avatar_url || m.profiles?.photo_url // Support both
            }));

            setMembers(active);
            setPendingUsers(pending);
        } catch (err) {
            console.error("Fetch members error:", err);
        } finally {
            setLoading(false);
        }
    }, [currentTeam]);

    const fetchParticipants = useCallback(async () => {
        if (!currentTeam) return;
        try {
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .eq('team_id', currentTeam.id);
            // Sorting manually in JS to avoid SQL 42703 error if created_at is missing
            const sortedData = data?.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)) || [];
            if (error) throw error;
            setParticipants(sortedData);
        } catch (err) {
            console.error("Fetch participants error:", err);
        }
    }, [currentTeam]);

    useEffect(() => {
        if (currentTeam) {
            fetchMembers();
            fetchParticipants();

            // Realtime subscriptions
            const memberChannel = supabase
                .channel(`members-${currentTeam.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter: `team_id=eq.${currentTeam.id}` }, () => fetchMembers())
                .subscribe();

            const participantChannel = supabase
                .channel(`participants-${currentTeam.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `team_id=eq.${currentTeam.id}` }, () => fetchParticipants())
                .subscribe();

            return () => {
                supabase.removeChannel(memberChannel);
                supabase.removeChannel(participantChannel);
            };
        }
    }, [currentTeam, fetchMembers, fetchParticipants]);

    const getInviteLink = () => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/login?invite=${currentTeam?.id}`;
    };

    const handleCopyInvite = () => {
        navigator.clipboard.writeText(`Hi！邀請你加入我們的「團隊分帳」群組成為協作者：\n\n${getInviteLink()}`);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleApprove = async (userId) => {
        const { error } = await supabase
            .from('team_members')
            .update({ status: 'member' })
            .eq('team_id', currentTeam.id)
            .eq('user_id', userId);

        if (error) alert("核准失敗");
        else await fetchMembers();
    };

    const handleReject = async (userId) => {
        const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('team_id', currentTeam.id)
            .eq('user_id', userId);

        if (error) alert("拒絕失敗");
        else await fetchMembers();
    };

    const handleToggleAdminStatus = async (userId, currentStatus) => {
        if (!isOwner || userId === currentUser.id) return;

        const newStatus = currentStatus === 'admin' ? 'member' : 'admin';

        const { error } = await supabase
            .from('team_members')
            .update({ status: newStatus })
            .eq('team_id', currentTeam.id)
            .eq('user_id', userId);

        if (error) {
            console.error("Toggle admin status error:", error);
            alert(`更新權限失敗: ${error.message}`);
        } else {
            await fetchMembers();
        }
    };

    const handleAddParticipant = async (e) => {
        e.preventDefault();
        if (!newParticipantName.trim() || !currentTeam || !isAdmin) return;

        setAddingParticipant(true);
        try {
            const { error } = await supabase
                .from('participants')
                .insert({
                    team_id: currentTeam.id,
                    name: newParticipantName.trim()
                });

            if (error) throw error;
            setNewParticipantName('');
            await fetchParticipants(); // Manual re-fetch for immediate feedback
        } catch (err) {
            console.error("Failed to add participant", err);
            alert("新增失敗");
        } finally {
            setAddingParticipant(false);
        }
    };

    const handleRemoveParticipant = async (participant) => {
        if (!currentTeam || !isAdmin) return;
        if (!confirm(`確定要刪除參與者 ${participant.name} 嗎？這不會刪除歷史帳單（名字會保留在歷史紀錄），但他將無法參與後續的新增結算。`)) return;

        try {
            const { error } = await supabase
                .from('participants')
                .delete()
                .eq('id', participant.id);
            if (error) throw error;
            await fetchParticipants(); // Manual re-fetch
        } catch (err) {
            console.error("Failed to remove participant", err);
            alert("刪除失敗");
        }
    };

    const handleAvatarUpload = async (participantId, file) => {
        if (!file || !currentTeam || !isAdmin) return;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${participantId}-${Math.random()}.${fileExt}`;
            const filePath = `${currentTeam.id}/${fileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    upsert: true,
                    cacheControl: '0' // Disable cache for the upload itself to ensure freshness
                });

            if (uploadError) throw uploadError;

            // 2. Get Public URL & Add timestamp for cache busting
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const publicUrlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

            // 3. Update Database
            const { error: updateError } = await supabase
                .from('participants')
                .update({ avatar_url: publicUrlWithTimestamp })
                .eq('id', participantId);

            if (updateError) throw updateError;

            console.log("Avatar updated successfully. New URL:", publicUrlWithTimestamp);

            // 4. Clear error state for this participant so it tries to load again
            setImageErrors(prev => {
                const next = new Set(prev);
                next.delete(participantId);
                return next;
            });

            await fetchParticipants();
        } catch (err) {
            console.error("Avatar upload error:", err);
            alert("圖片上傳失敗，請確認已在 Supabase 建立 'avatars' bucket。");
        }
    };

    const handleDeleteTeam = async () => {
        if (!currentTeam || !isAdmin) return;
        if (deleteConfirmText !== currentTeam.name) return;

        setIsDeleting(true);
        try {
            // CASCADE DELETE will handle transactions, splits, participants, and members
            const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', currentTeam.id);

            if (error) throw error;
            navigate('/setup');
        } catch (err) {
            console.error("Error deleting team: ", err);
            alert("刪除團隊失敗，請稍後再試。");
            setIsDeleting(false);
        }
    };

    if (!currentTeam) return <div className="text-center py-20 text-gray-400">載入中...</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">

            {/* Team Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">{currentTeam.name}</h2>
                        <span className="text-xs text-gray-500 font-mono">ID: {currentTeam.id}</span>
                    </div>
                </div>
            </div>

            {/* Participants Management */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-indigo-50/50 px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">消費參與者名單 ({participants.length})</h3>
                        <p className="text-xs text-gray-500 mt-1">這些是實際會在分帳表單上出現的名字 (無須 Google 帳號)。</p>
                    </div>

                    {isAdmin && (
                        <form onSubmit={handleAddParticipant} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newParticipantName}
                                onChange={e => setNewParticipantName(e.target.value)}
                                placeholder="輸入姓名"
                                className="border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-40"
                                required
                            />
                            <button
                                type="submit"
                                disabled={addingParticipant}
                                className="bg-[#5F3DC3] hover:bg-[#4E32A1] text-white p-2 rounded-lg transition"
                                title="新增參與者"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </form>
                    )}
                </div>

                <div className="p-6">
                    {participants.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>尚未加入任何參與者</p>
                            {isAdmin && <p className="text-sm mt-1 text-indigo-500">請在上方輸入姓名新增</p>}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {participants.map(p => (
                                <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between group hover:border-indigo-300 transition">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="relative shrink-0">
                                            {p.avatar_url && !imageErrors.has(p.id) ? (
                                                <img
                                                    src={p.avatar_url}
                                                    alt=""
                                                    className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm"
                                                    onError={() => {
                                                        console.error("Failed to load avatar for", p.name, ":", p.avatar_url);
                                                        setImageErrors(prev => new Set(prev).add(p.id));
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                                                    {p.name.charAt(0)}
                                                </div>
                                            )}
                                            {isAdmin && (
                                                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition">
                                                    <Camera className="w-4 h-4 text-white" />
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleAvatarUpload(p.id, file);
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                        <span className="font-medium text-gray-700 truncate">{p.name}</span>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleRemoveParticipant(p)}
                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition focus:opacity-100 shrink-0 ml-2"
                                            title="移除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Collaborators Management Section (Google Users) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 text-lg">協作者名單 ({members.length})</h3>
                    <p className="text-xs text-gray-500 mt-1">擁有授權權限，可以幫忙輸入或編輯帳單的人。</p>
                </div>

                {isAdmin ? (
                    <div className="bg-gray-50 p-6 border-b border-gray-100">
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <LinkIcon className="w-4 h-4 text-gray-400" /> WhatsApp 邀請協作者連結
                        </h4>
                        <p className="text-xs text-gray-500 mb-4">複製下方連結並傳送給想幫忙記帳的朋友。他們必須使用 Google 登入並由管理員核准。</p>

                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                readOnly
                                value={getInviteLink()}
                                className="flex-1 bg-white border border-gray-200 rounded-md py-2.5 px-3 text-sm text-gray-500 outline-none"
                            />
                            <button
                                onClick={handleCopyInvite}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition text-white shrink-0",
                                    copySuccess ? "bg-emerald-500 hover:bg-emerald-600" : "bg-gray-800 hover:bg-gray-700"
                                )}
                            >
                                {copySuccess ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copySuccess ? '已複製' : '複製邀請'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-blue-50 text-blue-800 text-sm p-4 m-6 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <p>您是此團隊的普通協作者。如需邀請新協作者，請聯絡團隊管理員索取邀請連結。</p>
                    </div>
                )}

                {/* Admin Approval Section */}
                {isAdmin && pendingUsers.length > 0 && (
                    <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center justify-between">
                        <h4 className="font-bold text-amber-800 text-sm">等待審核的協作者申請 ({pendingUsers.length})</h4>
                    </div>
                )}
                {isAdmin && pendingUsers.length > 0 && (
                    <ul className="divide-y divide-gray-100 bg-amber-50/30">
                        {pendingUsers.map(user => (
                            <li key={user.id} className="p-4 sm:px-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                            <Users className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-semibold text-gray-800">{user.display_name || '未知用戶'}</p>
                                        <p className="text-xs text-gray-500">{user.email}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleReject(user.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="拒絕"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleApprove(user.id)}
                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex items-center gap-1 font-medium text-sm pr-3"
                                    >
                                        <CheckCircle className="w-5 h-5" /> 批准
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Existing Collaborators List */}
                {loading ? (
                    <div className="p-8 text-center text-gray-400">載入中...</div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {members.map(user => (
                            <li key={user.id} className="p-4 sm:px-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full ring-2 ring-white shadow-sm" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                            <Users className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-semibold text-gray-800 flex items-center gap-2">
                                            {user.display_name || '未知用戶'}
                                            {user.id === currentTeam.admin_id ? (
                                                <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">擁有者</span>
                                            ) : user.status === 'admin' ? (
                                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-200">管理員</span>
                                            ) : null}
                                        </p>
                                        <p className="text-xs text-gray-500">{user.email}</p>
                                    </div>
                                </div>
                                {isOwner && user.id !== currentUser.id && (
                                    <button
                                        onClick={() => handleToggleAdminStatus(user.id, user.status)}
                                        className={cn(
                                            "text-xs font-semibold px-3 py-1.5 rounded-lg transition shrink-0 ml-2",
                                            user.status === 'admin'
                                                ? "text-red-600 bg-red-50 hover:bg-red-100"
                                                : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                                        )}
                                    >
                                        {user.status === 'admin' ? '取消管理員' : '設為管理員'}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Dangerous Zone */}
            {isAdmin && (
                <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 mt-8 overflow-hidden">
                    <div className="px-6 py-5 border-b border-red-100 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                        <div>
                            <h3 className="font-bold text-red-800 text-lg flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> 危險區域
                            </h3>
                            <p className="text-sm text-red-600 mt-1">此操作無法復原，將刪除整個團隊、所有成員紀錄與歷史帳單。</p>
                        </div>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 font-medium px-4 py-2.5 rounded-lg transition shrink-0"
                        >
                            刪除此團隊
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <AlertTriangle className="w-6 h-6 text-red-500" /> 刪除團隊
                            </h3>
                            <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }} className="text-gray-400 hover:text-gray-600 focus:outline-none transition">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <p className="text-gray-600 text-sm mb-4">
                            此操作將會永久刪除 <strong className="text-gray-900">{currentTeam.name}</strong> 團隊的所有資料，包含歷史帳單及成員設定。這項操作<strong>無法復原</strong>。
                        </p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                請輸入完整的團隊名稱 <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">{currentTeam.name}</span> 以確認刪除：
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={e => setDeleteConfirmText(e.target.value)}
                                placeholder="輸入團隊名稱"
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
                                disabled={isDeleting}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDeleteTeam}
                                disabled={deleteConfirmText !== currentTeam.name || isDeleting}
                                className={cn(
                                    "px-5 py-2.5 rounded-lg font-medium transition flex items-center justify-center min-w-[100px]",
                                    deleteConfirmText === currentTeam.name && !isDeleting
                                        ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                                        : "bg-red-300 text-white cursor-not-allowed"
                                )}
                            >
                                {isDeleting ? '刪除中...' : '確認刪除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
