import axios from 'axios'
import { create } from 'zustand'
import conf from '../conf'

const useAuth = create((set) => ({
    isAuth: false,
    fieldsSetting: false,
    getJwt: () => {
        const jwt = localStorage.getItem('jwt')
        if (jwt) {
            set({ isAuth: true })
            return jwt
        } else {
            set({ isAuth: false })
        }
    },
    exit: () => {
        localStorage.removeItem('jwt')
        set({ isAuth: false })
    },
    authing: async (identifier, password) => {
        try {
            const res = await axios.post(`${conf.urlBackend}/api/auth/local`, {
                identifier,
                password,
            })
            if (res.data) {
                console.log(res.data);
                localStorage.setItem('jwt', res.data.jwt)
                set((state) => ({ isAuth: true }))
            }

        } catch (error) {
            console.log(error);

        }
    },
    getFieldsSetting: async () => {
        try {
            const res = await axios.get(`${conf.urlBackend}/api/nastrojki-polejs?pagination[pageSize]=100`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("jwt")}`
                }
            })
            if (res.data) {
                console.log(res.data);
                set((state) => ({ fieldsSetting: res.data.data }))
            }

        } catch (error) {
            console.log(error);

        }
    },
}))

export default useAuth