import axios from 'axios'
import { create } from 'zustand'

const urlBackend = import.meta.env.VITE_URL_BACKEND

const useData = create((set) => ({
    tns: false,
    isLoadingTns: false,
    tn: false,
    isLoadingTn: false,
    isUpdatingTn: false,
    getTns: async (page, pageSize) => {
        try {
            set({ isLoadingTns: true })
            const res = await axios.get(`${urlBackend}/api/teh-narusheniyas?pagination[page]=${page}&pagination[pageSize]=${pageSize}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("jwt")}`
                }
            })
            if (res.data) {
                // console.log(res.data);
                set((state) => ({ tns: res.data, isLoadingTns: false }))
            }

        } catch (error) {
            set({ isLoadingTns: false })
            console.log(`Ошибка при получении всех ТН`, error);
        }
    },
    getTn: async (documentId) => {
        try {
            set({ isLoadingTn: true })
            const res = await axios.get(`${urlBackend}/api/teh-narusheniyas/${documentId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("jwt")}`
                }
            })
            if (res.data) {
                console.log(res.data);
                set((state) => ({ tn: res.data, isLoadingTn: false }))
            }

        } catch (error) {
            set({ isLoadingTn: false })
            console.log(`Ошибка при получении ТН ${documentId}`, error);
        }
    },
    updateTn: async (documentId, data) => {
        try {
            set({ isUpdatingTn: true })
            const res = await axios.put(`${urlBackend}/api/teh-narusheniyas/${documentId}`,
                {
                    data: {
                        data
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("jwt")}`
                    }
                })
            if (res.data) {
                console.log(res.data);
                set((state) => ({ isUpdatingTn: false }))
                return true
            }
            return false

        } catch (error) {
            set({ isUpdatingTn: false })
            console.log(`Ошибка при получении ТН ${documentId}`, error);
            return false
        }
    },
}))

export default useData


