import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getMe } from "../api/auth";

export const useUserStore = defineStore("user", () => {
    const token = ref("");
    const user = ref(null);
    const isLoggedIn = computed(() => !!token.value);

    async function fetchUser() {
        if (!token.value) return;
        try { const r = await getMe(); user.value = r.data; } catch { token.value = ""; user.value = null; }
    }
    function setAuth(t, u) { token.value = t; user.value = u; }
    function updateUser(u) { user.value = { ...user.value, ...u }; }
    function logout() { token.value = ""; user.value = null; }
    return { token, user, isLoggedIn, fetchUser, setAuth, updateUser, logout };
}, { persist: { key: "cm-user", storage: localStorage, pick: ["token", "user"] } });
