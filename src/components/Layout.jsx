import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Home, PlusCircle, Settings, Users, ChevronDown, ChevronUp, ArrowLeftRight, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';

import logo from '../assets/logo.png';

export default function Layout() {
    const { currentUser, currentTeam, userTeams, changeCurrentTeam } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showTeamDropdown, setShowTeamDropdown] = useState(false);

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            navigate('/login');
        } catch (error) {
            console.error('Failed to log out', error);
        }
    };

    const navLinks = [
        { name: '總覽', path: '/dashboard', icon: Home },
        { name: '新增帳目', path: '/add', icon: PlusCircle },
        { name: '還款及轉賬', path: '/repayment', icon: ArrowLeftRight },
        { name: '設定', path: '/settings', icon: Settings },
    ];

    if (!currentTeam) return null; // Should be handled by ProtectedRoute, but safe fallback

    return (
        <div className="min-h-screen bg-[#F8F9FE] flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">

                        {/* Left: Logo & Title */}
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                                <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
                                <div className="text-indigo-600 font-black text-xl tracking-tight">SplitMate</div>
                                <div className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-100 max-w-[120px] truncate">
                                    {currentTeam.name}
                                </div>
                            </div>

                            {/* Desktop Nav Tabs */}
                            <nav className="hidden md:flex items-center gap-1 h-16">
                                {navLinks.map((link) => {
                                    const Icon = link.icon;
                                    const isActive = location.pathname.startsWith(link.path);
                                    return (
                                        <Link
                                            key={link.path}
                                            to={link.path}
                                            className={cn(
                                                "flex items-center gap-2 px-4 h-full border-b-2 text-sm font-medium transition-colors",
                                                isActive
                                                    ? "border-indigo-600 text-indigo-600"
                                                    : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                                            )}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {link.name}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Right: User Email & Team Switch */}
                        <div className="flex items-center gap-4">
                            {currentUser?.email === 'ming1988@gmail.com' && (
                                <Link
                                    to="/admin"
                                    className="hidden sm:flex items-center gap-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-rose-100"
                                >
                                    <ShieldAlert className="w-3.5 h-3.5" /> 系統後台
                                </Link>
                            )}
                            <div className="hidden sm:block text-sm text-gray-600 font-medium">
                                {currentUser?.email}
                            </div>

                            {/* Team Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                                    className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 transition"
                                >
                                    <Users className="w-4 h-4 text-gray-500" />
                                    切換團隊
                                </button>

                                {showTeamDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowTeamDropdown(false)}></div>
                                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-20 py-2">
                                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">我的團隊</div>
                                            {userTeams.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => { changeCurrentTeam(t.id); setShowTeamDropdown(false); navigate('/dashboard'); }}
                                                    className={cn(
                                                        "w-full text-left px-4 py-2 text-sm flex items-center justify-between",
                                                        t.id === currentTeam.id ? "bg-indigo-50 text-indigo-700 font-bold" : "text-gray-700 hover:bg-gray-50"
                                                    )}
                                                >
                                                    <span className="truncate">{t.name}</span>
                                                    {t.id === currentTeam.id && <span className="w-2 h-2 rounded-full bg-indigo-500"></span>}
                                                </button>
                                            ))}
                                            <div className="border-t border-gray-100 mt-2 pt-2">
                                                <Link
                                                    to="/setup"
                                                    onClick={() => setShowTeamDropdown(false)}
                                                    className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-medium"
                                                >
                                                    <PlusCircle className="w-4 h-4" /> 建立新團隊
                                                </Link>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Logout (Desktop) */}
                            <button
                                onClick={handleLogout}
                                className="hidden md:flex items-center gap-2 bg-[#5F3DC3] hover:bg-[#4E32A1] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition"
                            >
                                <LogOut className="w-4 h-4" /> 登出
                            </button>
                        </div>

                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
                <Outlet />
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
                <div className="flex justify-around items-center h-16">
                    {navLinks.map((link) => {
                        const Icon = link.icon;
                        const isActive = location.pathname.startsWith(link.path);
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                                    isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                <Icon className={cn("w-5 h-5", isActive && "fill-indigo-100")} />
                                <span className="text-[10px] font-medium">{link.name}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
