import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userTeams, setUserTeams] = useState([]);
    const [currentTeam, setCurrentTeam] = useState(null);
    const [loading, setLoading] = useState(true);

    // Sync User Profile to Database
    const syncProfile = async (user) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    display_name: user.user_metadata?.full_name || user.email?.split('@')[0],
                    email: user.email,
                    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.photo_url,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });

            if (error) console.error("Profile sync error:", error);
        } catch (err) {
            console.error("Profile sync catch:", err);
        }
    };

    // Watch Authentication State
    useEffect(() => {
        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            const user = session?.user ?? null;
            setCurrentUser(user);
            if (user) syncProfile(user);
            setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const user = session?.user ?? null;
            setCurrentUser(user);
            if (user) syncProfile(user);
            if (!user) {
                setUserTeams([]);
                setCurrentTeam(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Watch Teams State (Supabase Version)
    useEffect(() => {
        if (!currentUser) return;

        // Fetch user teams (via team_members join)
        const fetchTeams = async () => {
            const { data, error } = await supabase
                .from('team_members')
                .select(`
                    status,
                    teams (
                        id,
                        name,
                        admin_id,
                        created_at
                    )
                `)
                .eq('user_id', currentUser.id);

            if (error) {
                console.error("Error fetching teams:", error);
                return [];
            }

            // Transform nested result to flat structure and deduplicate by team id
            const deduplicatedMap = new Map();
            data.forEach(item => {
                const team = item.teams;
                if (!team) return;

                // If already found, prefer 'admin' or 'member' status over 'pending' if applicable
                // (though filter already removes pending, this is safe for future changes)
                if (!deduplicatedMap.has(team.id) || item.status === 'admin') {
                    deduplicatedMap.set(team.id, {
                        id: team.id,
                        name: team.name,
                        admin_id: team.admin_id,
                        created_at: team.created_at,
                        member_status: item.status
                    });
                }
            });

            const teamsData = Array.from(deduplicatedMap.values())
                .filter(t => t.member_status === 'member' || t.member_status === 'admin');

            setUserTeams(teamsData);
            return teamsData;
        };

        const initTeams = async () => {
            const teamsData = await fetchTeams();
            if (teamsData.length > 0) {
                const savedTeamId = localStorage.getItem('lastSelectedTeamId');
                const foundSaved = teamsData.find(t => t.id === savedTeamId);
                const nextTeam = foundSaved || teamsData[0];
                setCurrentTeam(nextTeam);
            } else {
                setCurrentTeam(null);
            }
        };

        initTeams();

        // Subscribe to team_members changes for realtime updates
        const channel = supabase
            .channel('team_members_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'team_members',
                filter: `user_id=eq.${currentUser.id}`
            }, () => {
                fetchTeams();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [currentUser]);

    // Process Pending Invite
    useEffect(() => {
        if (!currentUser) return;
        const pendingInviteId = localStorage.getItem('pendingInvite');
        if (pendingInviteId) {
            joinTeam(pendingInviteId);
        }
    }, [currentUser]);

    const changeCurrentTeam = (teamOrId) => {
        if (!teamOrId) return;

        if (typeof teamOrId === 'string') {
            const team = userTeams.find(t => t.id === teamOrId);
            if (team) {
                setCurrentTeam(team);
                localStorage.setItem('lastSelectedTeamId', teamOrId);
            }
        } else {
            // Support passing a full team object directly to avoid race conditions
            setCurrentTeam(teamOrId);
            localStorage.setItem('lastSelectedTeamId', teamOrId.id);
            // Proactively add to userTeams if not already there to avoid flickering
            setUserTeams(prev => {
                const exists = prev.some(t => t.id === teamOrId.id);
                if (exists) return prev;
                return [...prev, teamOrId];
            });
        }
    }

    const joinTeam = async (teamId) => {
        if (!currentUser || !teamId) return false;

        try {
            // Ensure profile exists for admin to see
            await syncProfile(currentUser);

            // Check if team exists
            const { data: team, error: teamErr } = await supabase
                .from('teams')
                .select('id')
                .eq('id', teamId)
                .single();

            if (teamErr || !team) return false;

            // Check if already a member or pending
            const { data: membership } = await supabase
                .from('team_members')
                .select('status')
                .eq('team_id', teamId)
                .eq('user_id', currentUser.id)
                .maybeSingle(); // Use maybeSingle to avoid 406 error if not found

            if (!membership) {
                // Submit join request
                await supabase
                    .from('team_members')
                    .insert({
                        team_id: teamId,
                        user_id: currentUser.id,
                        status: 'pending'
                    });
            }
            return true;
        } catch (err) {
            console.error("Failed to join team:", err);
            return false;
        } finally {
            localStorage.removeItem('pendingInvite');
        }
    }

    const value = {
        currentUser,
        userTeams,
        currentTeam,
        changeCurrentTeam,
        joinTeam,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
