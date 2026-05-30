import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getMe } from "../api/auth";

export const useUserStore = defineStore("user", () => {
    const token = ref("");
    const user = ref(null);
    const authInitialized = ref(false);
    let authInitPromise = null;
    const isLoggedIn = computed(() => !!token.value);

    async function fetchUser() {
        if (!token.value) return;
        try { const r = await getMe(); user.value = r.data; } catch { token.value = ""; user.value = null; }
    }
    async function ensureAuth() {
        if (authInitialized.value) return;
        if (!authInitPromise) {
            authInitPromise = (async () => {
                if (token.value) await fetchUser();
                authInitialized.value = true;
            })().finally(() => {
                authInitPromise = null;
            });
        }
        return authInitPromise;
    }
    function setAuth(t, u) { token.value = t; user.value = u; }
    function updateUser(u) { user.value = { ...user.value, ...u }; }
    function logout() { token.value = ""; user.value = null; authInitialized.value = true; }
    return { token, user, authInitialized, isLoggedIn, fetchUser, ensureAuth, setAuth, updateUser, logout };
}, { persist: { key: "cm-user", storage: localStorage, pick: ["token", "user"] } });
